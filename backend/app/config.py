"""Configuration for Admin Backend"""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://n8n:n8n@localhost:5432/lead_qualification"
    )
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")
    # Токены входа в консоль (канон RF roles.py: admin + demo). Не настроены —
    # авторизация выключена (канон RF ops_auth_enabled: dev-режим без токена).
    admin_token: str = os.getenv("ADMIN_TOKEN", "")
    admin_demo_token: str = os.getenv("ADMIN_DEMO_TOKEN", "")

    class Config:
        env_file = ".env"


settings = Settings()