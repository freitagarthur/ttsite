from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    name: str | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class AnalysisHistoryItem(BaseModel):
    id: int
    asset: str
    filename: str
    summary: dict
    created_at: datetime | None

    model_config = {"from_attributes": True}
