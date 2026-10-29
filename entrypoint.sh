#!/bin/sh
set -e
# Aplica as migrações do banco (cria/atualiza tabelas) antes de iniciar a API.
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "Aplicando migrações do banco..."
  for i in 1 2 3 4 5 6 7 8 9 10; do
    alembic upgrade head && break
    echo "Banco ainda indisponível, tentando novamente em 3s ($i/10)..."
    sleep 3
  done
fi
exec "$@"
