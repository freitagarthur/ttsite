# TradeTutor

Plataforma web para análise estatística de ativos da bolsa a partir de arquivos de cotações diárias.

**Fase 1 — Análise de Ativo** (implementada):

- Cadastro/login com e-mail e senha (JWT) e login com Google (OAuth 2.0)
- Upload de arquivo `.csv` ou `.xlsx` com colunas `data, open, high, low, close` (outras colunas são descartadas)
- Rejeição de dados intraday (hora/minuto) ou semanais/mensais, com mensagem clara
- Análise descritiva: ativo (nome do arquivo), quantidade de dias, data inicial e final
- Análise estatística: variação diária média (com sinal e absoluta), maior alta/queda diária, distância percentual absoluta (atual, média e máxima) do fechamento às MMAs 9, 21 e 200, frequência de gaps, distância absoluta da última máxima (e do último fechamento) para a MMA 200, IFR 14 atual, correlação de Pearson dos retornos diários com o IBOV (`^BVSP` via yfinance)
- Gráfico de candles navegável (zoom/arraste) com MMAs 9/21/200 e painel de IFR 14 sincronizado (TradingView Lightweight Charts)
- Tema claro/escuro, interface em português, layout responsivo
- Histórico das análises salvo por usuário

**Fase 2 — Análise de Trades**: botão já presente no cabeçalho (desabilitado).

---

## 1. Arquitetura

```
Navegador ──► Nginx (80/443) ──┬─► /api/*  → backend  (FastAPI · Python 3.11) ──► PostgreSQL 15
                               │                                                └─► Redis 7 ◄── worker (Celery)
                               └─► /*      → frontend (Next.js 14 · TypeScript · Tailwind)
```

Tudo roda em contêineres Docker, orquestrados pelo Docker Compose:

| Serviço    | Função                                                |
|------------|-------------------------------------------------------|
| `nginx`    | Proxy reverso, HTTPS, limite de upload (20 MB)        |
| `frontend` | Interface web (Next.js)                               |
| `backend`  | API REST (FastAPI) — aplica as migrações ao iniciar   |
| `worker`   | Celery para tarefas em segundo plano (base p/ fase 2) |
| `db`       | PostgreSQL 15 (usuários e histórico)                  |
| `redis`    | Fila/cache do Celery                                  |
| `certbot`  | (só produção) emissão/renovação automática do SSL     |

Estrutura de pastas:

```
tradetutor/
├── backend/            # FastAPI
│   ├── app/
│   │   ├── main.py     # aplicação e rotas
│   │   ├── routers/    # auth.py, analysis.py
│   │   ├── models/     # tabelas (SQLAlchemy)
│   │   ├── schemas/    # validação (Pydantic)
│   │   ├── services/   # asset_analysis.py (toda a estatística)
│   │   ├── core/       # config, banco, segurança/JWT
│   │   └── worker.py   # Celery
│   ├── alembic/        # migrações do banco
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/           # Next.js
│   ├── src/app/        # páginas (/analise-ativo, /login, /cadastro, ...)
│   ├── src/components/ # Header, gráfico, resultados, formulários
│   ├── src/lib/        # cliente da API e formatação
│   └── Dockerfile
├── nginx/
│   ├── nginx.conf      # HTTP (primeiro deploy)
│   └── nginx.prod.conf # HTTPS (produção)
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.example
```

---

## 2. Requisitos de hospedagem

Contrate um **VPS** (servidor virtual com acesso root/SSH). Hospedagens compartilhadas comuns (cPanel, "hospedagem de sites PHP") **não servem**, pois não permitem Docker.

| Item              | Mínimo                     | Recomendado                |
|-------------------|----------------------------|----------------------------|
| Sistema           | Ubuntu 22.04 LTS 64 bits   | Ubuntu 22.04 / 24.04 LTS   |
| CPU               | 2 vCPU                     | 2–4 vCPU                   |
| Memória RAM       | 2 GB (+ 2 GB de swap)      | 4 GB                       |
| Disco             | 25 GB SSD                  | 40 GB SSD/NVMe             |
| Rede              | IPv4 público, portas 22/80/443 liberadas | —            |
| Domínio           | Um domínio próprio (ex.: `tradetutor.com.br`) apontado para o IP do VPS | — |

Exemplos de provedores: Hostinger VPS (KVM 2), Contabo, DigitalOcean, Vultr, Hetzner, Locaweb VPS, Magalu Cloud. Custo típico: R$ 30 a R$ 80/mês.

> Observação: a construção (build) das imagens consome bastante memória. Em VPS de 2 GB, crie o swap (passo 3.3).

---

## 3. Deploy com Coolify

O Coolify já está instalado no seu servidor e cuida automaticamente do proxy reverso (Traefik), dos certificados SSL (Let's Encrypt) e do Docker Compose. Não é necessário instalar Nginx, rodar Certbot manualmente nem editar arquivos de proxy.

### 3.1 Apontar o domínio para o servidor

No painel do seu registrador de domínio (Registro.br, GoDaddy, Hostinger etc.) crie dois registros DNS:

| Tipo | Nome  | Valor            |
|------|-------|------------------|
| A    | `@`   | IP do VPS        |
| A    | `www` | IP do VPS        |

A propagação pode levar de alguns minutos a algumas horas. Verifique com `ping seudominio.com` antes de continuar.

### 3.2 Subir o código para um repositório Git

O Coolify precisa de um repositório Git para fazer o deploy. Crie um repositório no **GitHub**, **GitLab** ou **Gitea** (pode ser privado) e envie o código:

```bash
# Na sua máquina local, dentro da pasta do projeto:
git remote add origin https://github.com/SEU_USUARIO/tradetutor.git
git push -u origin main
```

### 3.3 Criar o recurso no Coolify

1. Acesse o painel do Coolify no seu servidor: `http://IP_DO_VPS:8000` (ou o domínio que você configurou para o Coolify).
2. Clique em **Projects → + New Project** e dê o nome `tradetutor`.
3. Dentro do projeto, clique em **+ New Resource → Docker Compose**.
4. Selecione o servidor e conecte seu repositório Git (autorize a conta GitHub/GitLab se solicitado).
5. Escolha o repositório `tradetutor` e o branch `main`.
6. Em **Docker Compose Location**, mantenha `/` (raiz do repositório).
7. Coolify detectará o `docker-compose.yml` automaticamente.

### 3.4 Configurar as variáveis de ambiente

Ainda na tela de configuração do recurso, clique em **Environment Variables** e adicione as seguintes variáveis (uma por linha):

```
POSTGRES_USER=tradetutor
POSTGRES_DB=tradetutor
POSTGRES_PASSWORD=SUA_SENHA_FORTE_AQUI
DATABASE_URL=postgresql://tradetutor:SUA_SENHA_FORTE_AQUI@db:5432/tradetutor
REDIS_URL=redis://redis:6379/0
SECRET_KEY=GERE_COM_openssl_rand_-hex_32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_URL=https://seudominio.com
NEXT_PUBLIC_API_URL=https://seudominio.com/api
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://seudominio.com/api/auth/google/callback
ENVIRONMENT=production
CORS_ORIGINS=https://seudominio.com
```

> Para gerar o `SECRET_KEY`, execute no terminal do VPS: `openssl rand -hex 32`
> Evite os caracteres `@ : / # %` na senha do banco, pois ela também aparece dentro da `DATABASE_URL`.

### 3.5 Configurar o domínio e SSL no Coolify

1. Na aba **Domains** do recurso, clique em **+ Add Domain**.
2. Digite `https://seudominio.com` — o Coolify ativa o HTTPS automaticamente via Let's Encrypt.
3. Em **Port**, coloque `80` (o serviço Nginx dentro do Docker Compose escuta na porta 80 internamente; o Coolify/Traefik faz a terminação SSL e repassa para lá).

### 3.6 Fazer o deploy

Clique em **Deploy** (ou **Save and Deploy**). O Coolify irá:

1. Clonar o repositório.
2. Executar `docker compose up --build -d` com as variáveis que você configurou.
3. Emitir e configurar o certificado SSL automaticamente.
4. Disponibilizar o site em `https://seudominio.com`.

Acompanhe o progresso na aba **Logs** em tempo real.

> As tabelas do banco são criadas automaticamente pelo Alembic quando o backend sobe pela primeira vez.

### 3.7 Atualizar o site após mudanças no código

Sempre que fizer `git push` no repositório, vá ao painel do Coolify e clique em **Redeploy** — ou ative o **Auto Deploy** para que o Coolify faça isso sozinho a cada push.

---

## 4. Configurar o login com Google

1. Acesse <https://console.cloud.google.com/> e crie um projeto (ex.: "TradeTutor").
2. Menu **APIs e serviços → Tela de permissão OAuth**: tipo **Externo**, preencha nome do app, e-mail de suporte e domínio; publique o app.
3. Menu **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**
   - Origens JavaScript autorizadas: `https://seudominio.com`
   - URIs de redirecionamento autorizados: `https://seudominio.com/api/auth/google/callback`
4. Copie o **ID do cliente** e a **Chave secreta** para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env`.
5. Reinicie o backend: `dc up -d backend`.

---

## 5. Operação do dia a dia

A maioria das tarefas pode ser feita pelo painel do Coolify (aba **Logs**, botão **Restart**, **Redeploy** etc.). Para operações avançadas, acesse o VPS via SSH e use os comandos abaixo (o Coolify roda o Docker Compose numa pasta gerada automaticamente — use `docker compose` com o caminho correto, ou acesse pelo painel):

| Tarefa | Pelo painel Coolify | Via SSH no VPS |
|---|---|---|
| Ver logs | Aba **Logs** do recurso | `docker compose logs -f backend` |
| Reiniciar um serviço | Botão **Restart** | `docker compose restart backend` |
| Atualizar após push | Botão **Redeploy** | automático se Auto Deploy ativado |
| Parar tudo | Botão **Stop** | `docker compose down` |
| Backup do banco | — | `docker compose exec db pg_dump -U tradetutor tradetutor > backup_$(date +%F).sql` |
| Restaurar backup | — | `cat backup.sql \| docker compose exec -T db psql -U tradetutor tradetutor` |
| Migrações manuais | — | `docker compose exec backend alembic upgrade head` |

Os contêineres reiniciam sozinhos se o VPS for reiniciado (`restart: unless-stopped`).

---

## 6. Formato do arquivo aceito

- Extensões: `.csv` ou `.xlsx` (até 20 MB)
- Colunas obrigatórias (cabeçalho na 1ª linha): `data, open, high, low, close`
  (também são aceitos `date`, `abertura`, `maxima`, `minima`, `fechamento`; demais colunas são ignoradas)
- CSV separado por vírgula ou ponto e vírgula; números com ponto ou vírgula decimal (`1.234,56`)
- Datas `AAAA-MM-DD` ou `DD/MM/AAAA`
- Um registro por pregão (dados **diários**). Arquivos com hora/minuto são recusados.
- O nome do arquivo vira o nome do ativo (ex.: `PETR4.csv` → **PETR4**)

Exemplo:

```csv
data,open,high,low,close
2024-01-02,37.10,37.55,36.90,37.40
2024-01-03,37.40,38.02,37.20,37.95
```

---

## 7. Metodologia dos cálculos

| Métrica | Como é calculada |
|---------|------------------|
| Variação diária | `(fechamento / fechamento anterior − 1) × 100` |
| Variação diária média | Média das variações diárias (com sinal); também exibida a média dos valores absolutos e o desvio padrão |
| Maior alta / queda | Maior e menor variação diária do período |
| Distância às MMAs 9/21/200 | `abs(fechamento − MMA) / MMA × 100` (média aritmética simples); exibidos valor atual, média e máximo |
| Gaps | Abertura acima da máxima do dia anterior (gap de alta) ou abaixo da mínima anterior (gap de baixa); frequência = gaps / dias comparados |
| Máxima atual × MMA 200 | `abs(máxima do último dia − MMA200) / MMA200 × 100` |
| IFR 14 | Método de Wilder (médias exponenciais com α = 1/14) |
| Correlação com IBOV | Pearson entre retornos diários do ativo e do `^BVSP` (Yahoo Finance) nas datas em comum (mínimo 20 dias) |

Os indicadores (MMA e IFR) são calculados diretamente com pandas, sem depender do pacote `pandas-ta`, que é incompatível com as versões atuais do NumPy.
Se o Yahoo Finance estiver indisponível, a análise é concluída normalmente e a correlação aparece como indisponível.

---

## 8. Desenvolvimento local (opcional)

Requer Docker Desktop. Na raiz do projeto:

```bash
cp .env.example .env     # ajuste FRONTEND_URL=http://localhost e GOOGLE_REDIRECT_URI=http://localhost/api/auth/google/callback
docker compose up --build
```

Acesse <http://localhost>. Documentação interativa da API: <http://localhost/api/docs>.

---

## 9. Solução de problemas

| Sintoma | Causa provável / solução |
|---------|--------------------------|
| `502 Bad Gateway` | Backend ou frontend ainda iniciando ou com erro: `dc logs backend frontend` |
| Backend reinicia em loop com erro de senha | `POSTGRES_PASSWORD` diferente da senha na `DATABASE_URL`. Se mudou a senha depois da 1ª subida, apague o volume: `dc down -v` (**apaga os dados**) |
| Erro ao subir arquivo grande | Limite de 20 MB (`client_max_body_size` no Nginx e `MAX_UPLOAD_MB` no backend) |
| Login Google: `redirect_uri_mismatch` | A URI no Google Cloud deve ser idêntica a `GOOGLE_REDIRECT_URI` |
| Login Google: "não configurado" | `GOOGLE_CLIENT_ID` vazio no `.env` |
| Build trava/morre por falta de memória | Crie swap (passo 3.3) |
| Correlação com IBOV indisponível | Yahoo Finance fora do ar ou bloqueando o IP do servidor; tente mais tarde |
