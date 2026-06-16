-- n8n Lead Qualification Assistant
-- Database Schema
-- Version: 1.0
-- Based on: IMPLEMENTATION_PLAN v1.0

-- Connect to the business database
-- n8n internal tables will be in the 'n8n' database (created by n8n automatically)
-- Business tables will be in the 'lead_qualification' database

\c lead_qualification

-- ============================================================================
-- Table: leads
-- Purpose: Store incoming leads from all channels
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE,
    source VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'received',
    utm_source VARCHAR(100),
    utm_campaign VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for leads
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

COMMENT ON TABLE leads IS 'Incoming leads from web-form and Telegram channels';
COMMENT ON COLUMN leads.id IS 'Internal unique identifier';
COMMENT ON COLUMN leads.external_id IS 'ID from external system (CRM, Telegram)';
COMMENT ON COLUMN leads.source IS 'Lead source: web, telegram';
COMMENT ON COLUMN leads.status IS 'Lead status: received, qualified, processed, archived';

-- ============================================================================
-- Table: messages
-- Purpose: Store all messages related to leads
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

COMMENT ON TABLE messages IS 'All incoming and outgoing messages for leads';
COMMENT ON COLUMN messages.channel IS 'Message channel: web, telegram';
COMMENT ON COLUMN messages.direction IS 'Message direction: inbound, outbound';

-- ============================================================================
-- Table: qualifications
-- Purpose: Store AI classification results for leads
-- ============================================================================

CREATE TABLE IF NOT EXISTS qualifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    lead_type VARCHAR(20) NOT NULL,
    interest VARCHAR(20) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    summary TEXT,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    suggested_action VARCHAR(50) NOT NULL,
    reasoning TEXT,
    ai_model VARCHAR(50) NOT NULL,
    processing_ms INTEGER,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for qualifications
CREATE INDEX IF NOT EXISTS idx_qualifications_lead_id ON qualifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_qualifications_lead_type ON qualifications(lead_type);
CREATE INDEX IF NOT EXISTS idx_qualifications_priority ON qualifications(priority);
CREATE INDEX IF NOT EXISTS idx_qualifications_processed_at ON qualifications(processed_at);

-- Check constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lead_type') THEN
        ALTER TABLE qualifications ADD CONSTRAINT chk_lead_type
            CHECK (lead_type IN ('hot', 'warm', 'cold', 'spam'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_interest') THEN
        ALTER TABLE qualifications ADD CONSTRAINT chk_interest
            CHECK (interest IN ('high', 'medium', 'low'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_priority') THEN
        ALTER TABLE qualifications ADD CONSTRAINT chk_priority
            CHECK (priority IN ('high', 'medium', 'low'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_suggested_action') THEN
        ALTER TABLE qualifications ADD CONSTRAINT chk_suggested_action
            CHECK (suggested_action IN ('call', 'email', 'archive', 'reject'));
    END IF;
END $$;

COMMENT ON TABLE qualifications IS 'AI classification results for each lead';
COMMENT ON COLUMN qualifications.lead_type IS 'Lead classification: hot, warm, cold, spam';
COMMENT ON COLUMN qualifications.confidence IS 'Classification confidence score (0.00-1.00)';
COMMENT ON COLUMN qualifications.ai_model IS 'AI model used for classification';
COMMENT ON COLUMN qualifications.processing_ms IS 'Processing time in milliseconds';

-- ============================================================================
-- Table: crm_sync
-- Purpose: Track CRM synchronization status
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    crm_type VARCHAR(50) NOT NULL,
    crm_lead_id VARCHAR(100),
    sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sync_error TEXT,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for crm_sync
CREATE INDEX IF NOT EXISTS idx_crm_sync_lead_id ON crm_sync(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_crm_type ON crm_sync(crm_type);
CREATE INDEX IF NOT EXISTS idx_crm_sync_status ON crm_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_crm_sync_synced_at ON crm_sync(synced_at);

-- Check constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_crm_type') THEN
        ALTER TABLE crm_sync ADD CONSTRAINT chk_crm_type
            CHECK (crm_type IN ('kommo', 'bitrix24'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sync_status') THEN
        ALTER TABLE crm_sync ADD CONSTRAINT chk_sync_status
            CHECK (sync_status IN ('pending', 'success', 'failed'));
    END IF;
END $$;

COMMENT ON TABLE crm_sync IS 'CRM synchronization tracking';
COMMENT ON COLUMN crm_sync.crm_type IS 'CRM system: kommo, bitrix24';
COMMENT ON COLUMN crm_sync.crm_lead_id IS 'Lead ID in CRM';
COMMENT ON COLUMN crm_sync.sync_status IS 'Sync status: pending, success, failed';

-- ============================================================================
-- Table: follow_ups
-- Purpose: Track follow-up actions for leads
-- ============================================================================

CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    result TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for follow_ups
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled_at ON follow_ups(scheduled_at);

-- Check constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_action_type') THEN
        ALTER TABLE follow_ups ADD CONSTRAINT chk_action_type
            CHECK (action_type IN ('telegram_message', 'crm_task', 'email'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_follow_up_status') THEN
        ALTER TABLE follow_ups ADD CONSTRAINT chk_follow_up_status
            CHECK (status IN ('pending', 'executed', 'failed'));
    END IF;
END $$;

COMMENT ON TABLE follow_ups IS 'Follow-up actions for leads';
COMMENT ON COLUMN follow_ups.action_type IS 'Action type: telegram_message, crm_task, email';
COMMENT ON COLUMN follow_ups.scheduled_at IS 'Scheduled execution time';
COMMENT ON COLUMN follow_ups.executed_at IS 'Actual execution time';

-- ============================================================================
-- Table: logs
-- Purpose: System-wide event logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for logs
CREATE INDEX IF NOT EXISTS idx_logs_lead_id ON logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_logs_event_type ON logs(event_type);
CREATE INDEX IF NOT EXISTS idx_logs_status ON logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);

-- Check constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_log_status') THEN
        ALTER TABLE logs ADD CONSTRAINT chk_log_status
            CHECK (status IN ('success', 'error', 'warning'));
    END IF;
END $$;

COMMENT ON TABLE logs IS 'System event logging for observability';
COMMENT ON COLUMN logs.event_type IS 'Event type: lead_received, lead_classified, crm_sync, follow_up';
COMMENT ON COLUMN logs.event_data IS 'JSON payload with event details';
COMMENT ON COLUMN logs.status IS 'Event status: success, error, warning';

-- ============================================================================
-- Utility Functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for leads table (idempotent)
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Initial Data (Optional)
-- ============================================================================

-- No initial data required - tables will be populated by the application