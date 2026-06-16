"""Main FastAPI application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import dashboard, leads, health

app = FastAPI(
    title="Lead Qualification Admin API",
    description="Admin backend for Lead Qualification system",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(dashboard.router, prefix="/api/admin", tags=["dashboard"])
app.include_router(leads.router, prefix="/api/admin", tags=["leads"])
app.include_router(health.router, prefix="/api/admin", tags=["health"])