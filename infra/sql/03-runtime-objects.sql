-- n8n Lead Qualification Assistant
-- Runtime Objects Migration
-- Version: 1.0
-- Date: 2026-06-14
-- Purpose: Legitimize runtime objects created during development
-- Source: Recovery Audit 2026-06-14

-- ============================================================================
-- IMPORTANT: This script adds objects that exist in production database
-- but were missing from repository SQL files.
-- ============================================================================

-- Connect to the business database
\c lead_qualification

-- ============================================================================
-- SEQUENCE: lead_public_number_seq
-- Purpose: Generate unique public lead numbers (LQ-NNNNNN)
-- Used by: generate_public_number() function
-- ============================================================================

-- Check if sequence exists, create if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'lead_public_number_seq') THEN
        -- Create sequence starting from 100001 (LQ-100001 format)
        CREATE SEQUENCE lead_public_number_seq
            START WITH 100001
            INCREMENT BY 1
            NO MINVALUE
            NO MAXVALUE
            CACHE 1;

        RAISE NOTICE 'Created sequence lead_public_number_seq';
    ELSE
        RAISE NOTICE 'Sequence lead_public_number_seq already exists';
    END IF;
END $$;

-- Set sequence ownership to leads table
ALTER SEQUENCE lead_public_number_seq OWNED BY leads.public_number;

COMMENT ON SEQUENCE lead_public_number_seq IS 'Sequence for generating public lead numbers in format LQ-NNNNNN';

-- ============================================================================
-- COLUMN: leads.public_number
-- Purpose: Human-readable lead identifier
-- Format: LQ-NNNNNN (e.g., LQ-100001, LQ-100024)
-- ============================================================================

-- Check if column exists, add if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'public_number'
    ) THEN
        -- Add public_number column
        ALTER TABLE leads ADD COLUMN public_number VARCHAR(20);

        -- Add UNIQUE constraint
        ALTER TABLE leads ADD CONSTRAINT leads_public_number_key UNIQUE (public_number);

        -- Create index (automatic with UNIQUE constraint, but explicit for clarity)
        CREATE INDEX idx_leads_public_number ON leads(public_number);

        RAISE NOTICE 'Added column leads.public_number with UNIQUE constraint';
    ELSE
        RAISE NOTICE 'Column leads.public_number already exists';
    END IF;
END $$;

COMMENT ON COLUMN leads.public_number IS 'Human-readable lead number in format LQ-NNNNNN';

-- ============================================================================
-- FUNCTION: generate_public_number()
-- Purpose: Generate next public lead number
-- Returns: VARCHAR in format 'LQ-NNNNNN'
-- Usage: Called explicitly in n8n workflows during lead insertion
-- ============================================================================

-- Create or replace function (idempotent)
CREATE OR REPLACE FUNCTION generate_public_number()
RETURNS VARCHAR(20) AS $$
BEGIN
    RETURN 'LQ-' || nextval('lead_public_number_seq')::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_public_number() IS 'Generate next public lead number in format LQ-NNNNNN';

-- ============================================================================
-- TABLE: logs
-- Purpose: System event logging
-- Created: During development for tracking lead events
-- ============================================================================

-- Check if table exists, create if not
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_logs_lead_id ON logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_logs_event_type ON logs(event_type);
CREATE INDEX IF NOT EXISTS idx_logs_status ON logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);

-- Add check constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_log_status') THEN
        ALTER TABLE logs ADD CONSTRAINT chk_log_status
            CHECK (status IN ('success', 'error', 'warning'));
    END IF;
END $$;

COMMENT ON TABLE logs IS 'System event logs for lead processing';
COMMENT ON COLUMN logs.event_type IS 'Event type: lead_received, lead_classified, crm_sync_success, crm_sync_error, etc.';
COMMENT ON COLUMN logs.event_data IS 'JSON payload with event details';
COMMENT ON COLUMN logs.status IS 'Event status: success, error, warning';

-- ============================================================================
-- VIEW: leads_with_contacts
-- Purpose: Convenient join of leads with contacts for reporting
-- Created: During development for easier data access
-- ============================================================================

-- Create or replace view (idempotent)
CREATE OR REPLACE VIEW leads_with_contacts AS
SELECT
    l.id,
    l.contact_id,
    l.source,
    l.status,
    l.utm_source,
    l.utm_campaign,
    l.created_at,
    l.updated_at,
    c.name AS contact_name,
    c.phone AS contact_phone,
    c.email AS contact_email,
    c.company AS contact_company
FROM leads l
LEFT JOIN contacts c ON l.contact_id = c.id;

COMMENT ON VIEW leads_with_contacts IS 'Join of leads with contacts for convenient reporting';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 03-runtime-objects completed successfully';
    RAISE NOTICE 'Objects added:';
    RAISE NOTICE '  - lead_public_number_seq (sequence)';
    RAISE NOTICE '  - leads.public_number (column)';
    RAISE NOTICE '  - generate_public_number() (function)';
    RAISE NOTICE '  - logs (table)';
    RAISE NOTICE '  - leads_with_contacts (view)';
END $$;