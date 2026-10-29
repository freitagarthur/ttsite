from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginIn, RegisterIn, TokenOut, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _access_token(user: User) -> str:
    return create_token(str(user.id), extra={"type": "access"})


@router.post("/register", response_model=TokenOut, status_code=201)
async def register(data: RegisterIn, db: AsyncSession = Depends(get_db)):
    email = data.email.lower()
    exists = await db.scalar(select(User).where(User.email == email))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Este e-mail já está cadastrado.")
    user = User(email=email, name=data.name.strip(), hashed_password=hash_password(data.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenOut(access_token=_access_token(user))


@router.post("/login", response_model=TokenOut)
async def login(data: LoginIn, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha incorretos.")
    return TokenOut(access_token=_access_token(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.get("/google/login")
async def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Login com Google não configurado no servidor.")
    state = create_token("google-oauth", minutes=10, extra={"type": "state"})
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


def _front_redirect(**params) -> RedirectResponse:
    return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/auth/callback?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    if error or not code or not state:
        return _front_redirect(error="Login com Google cancelado.")
    try:
        if decode_token(state).get("type") != "state":
            raise JWTError()
    except JWTError:
        return _front_redirect(error="Sessão de login expirada. Tente novamente.")

    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            return _front_redirect(error="Falha ao autenticar com o Google.")
        access = token_resp.json().get("access_token")
        info_resp = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access}"})
        if info_resp.status_code != 200:
            return _front_redirect(error="Falha ao obter dados da conta Google.")
        info = info_resp.json()

    email = (info.get("email") or "").lower()
    if not email or not info.get("email_verified", False):
        return _front_redirect(error="A conta Google não possui e-mail verificado.")

    user = await db.scalar(select(User).where(User.google_sub == info["sub"]))
    if not user:
        user = await db.scalar(select(User).where(User.email == email))
        if user:
            user.google_sub = info["sub"]
        else:
            user = User(email=email, name=info.get("name"), google_sub=info["sub"])
            db.add(user)
        await db.commit()
        await db.refresh(user)
    return _front_redirect(token=_access_token(user))
