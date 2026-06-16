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

    class Config:
        env_file = ".env"


settings = Settings()