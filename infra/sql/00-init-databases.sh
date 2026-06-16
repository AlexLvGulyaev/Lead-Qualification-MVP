#!/bin/bash
# n8n Lead Qualification Assistant
# Database Initialization Script
# Creates databases with idempotent operations
# Version: 1.0

set -e

# Create n8n database (may already exist due to POSTGRES_USER behavior)
psql -v ON_ERROR_STOP=0 -U "$POSTGRES_USER" -d postgres <<EOF
-- n8n database for internal n8n tables
-- Ignore error if already exists (PostgreSQL creates database with user name)
CREATE DATABASE n8n
    WITH
    OWNER = $POSTGRES_USER
    ENCODING = 'UTF8'
    LC_COLLATE = 'C.UTF-8'
    LC_CTYPE = 'C.UTF-8'
    TEMPLATE = template0;
EOF

# Create lead_qualification database
psql -v ON_ERROR_STOP=0 -U "$POSTGRES_USER" -d postgres <<EOF
-- Business database for lead qualification workflow
CREATE DATABASE lead_qualification
    WITH
    OWNER = $POSTGRES_USER
    ENCODING = 'UTF8'
    LC_COLLATE = 'C.UTF-8'
    LC_CTYPE = 'C.UTF-8'
    TEMPLATE = template0;
EOF

echo "Database initialization complete: n8n, lead_qualification"