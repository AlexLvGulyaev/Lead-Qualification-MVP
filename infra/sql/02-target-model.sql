-- n8n Lead Qualification Assistant
-- Target Model Migration
-- Version: 2.0
-- Date: 2026-06-12
-- Purpose: Implement proper separation of Contact, Channel Identity, and Lead

-- ============================================================================
-- PHASE 1: Create new tables
-- ============================================================================

-- Connect to the business database
\c lead_qualification

-- ============================================================================
-- Table: contacts
-- Purpose: Store person/organization information (the WHO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    company VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);

COMMENT ON TABLE contacts IS 'Persons or organizations - the WHO behind leads';
COMMENT ON COLUMN contacts.id IS 'Internal unique identifier';
COMMENT ON COLUMN contacts.name IS 'Contact name (person or company)';
COMMENT ON COLUMN contacts.phone IS 'Primary phone number';
COMMENT ON COLUMN contacts.email IS 'Primary email address';
COMMENT ON COLUMN contacts.company IS 'Company name (if B2B)';
COMMENT ON COLUMN contacts.notes IS 'Additional notes about contact';

-- ============================================================================
-- Table: channel_identities
-- Purpose: Store external identifiers in various channels (Telegram, Web, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS channel_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    channel_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- One external_id per channel
    CONSTRAINT uq_channel_identity UNIQUE(channel, external_id)
);

-- Indexes for channel_identities
CREATE INDEX IF NOT EXISTS idx_channel_identities_contact_id ON channel_identities(contact_id);
CREATE INDEX IF NOT EXISTS idx_channel_identities_channel ON channel_identities(channel);
CREATE INDEX IF NOT EXISTS idx_channel_identities_external_id ON channel_identities(external_id);

COMMENT ON TABLE channel_identities IS 'External identifiers in channels (Telegram, Web, etc.)';
COMMENT ON COLUMN channel_identities.channel IS 'Channel name: telegram, web, whatsapp, etc.';
COMMENT ON COLUMN channel_identities.external_id IS 'ID in external system (e.g., telegram_user_id)';
COMMENT ON COLUMN channel_identities.channel_data IS 'Additional channel-specific data (username, etc.)';

-- ============================================================================
-- Table: leads (REDEFINED)
-- Purpose: Store individual requests/inquiries (the WHAT)
-- Now references contacts instead of storing contact data directly
-- ============================================================================

-- First, drop the old external_id unique constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'leads_external_id_key'
        AND conrelid = 'leads'::regclass
    ) THEN
        ALTER TABLE leads DROP CONSTRAINT leads_external_id_key;
    END IF;
END $$;

-- Add contact_id column to leads
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'contact_id'
    ) THEN
        ALTER TABLE leads ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add index for contact_id
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads(contact_id);

-- Update comment
COMMENT ON TABLE leads IS 'Individual requests/inquiries - the WHAT contacts want';
COMMENT ON COLUMN leads.contact_id IS 'Reference to the contact who made this request';
COMMENT ON COLUMN leads.external_id IS 'DEPRECATED: Use channel_identities table instead';

-- ============================================================================
-- PHASE 2: Migrate existing data
-- ============================================================================

-- Function to migrate existing leads to contacts and channel_identities
CREATE OR REPLACE FUNCTION migrate_leads_to_target_model()
RETURNS void AS $$
DECLARE
    lead_record RECORD;
    new_contact_id UUID;
    existing_contact_id UUID;
BEGIN
    -- Process each lead
    FOR lead_record IN SELECT * FROM leads WHERE contact_id IS NULL LOOP
        -- Try to find existing contact by phone or email
        existing_contact_id := NULL;

        IF lead_record.phone IS NOT NULL AND lead_record.phone != '' THEN
            SELECT id INTO existing_contact_id FROM contacts WHERE phone = lead_record.phone LIMIT 1;
        END IF;

        IF existing_contact_id IS NULL AND lead_record.email IS NOT NULL AND lead_record.email != '' THEN
            SELECT id INTO existing_contact_id FROM contacts WHERE email = lead_record.email LIMIT 1;
        END IF;

        -- If no existing contact, create new one
        IF existing_contact_id IS NULL THEN
            INSERT INTO contacts (name, phone, email, created_at, updated_at)
            VALUES (
                lead_record.name,
                lead_record.phone,
                lead_record.email,
                lead_record.created_at,
                lead_record.updated_at
            )
            RETURNING id INTO new_contact_id;

            existing_contact_id := new_contact_id;
        END IF;

        -- Update lead with contact_id
        UPDATE leads SET contact_id = existing_contact_id WHERE id = lead_record.id;

        -- Create channel_identity for telegram leads
        IF lead_record.source = 'telegram' AND lead_record.external_id IS NOT NULL THEN
            INSERT INTO channel_identities (contact_id, channel, external_id, created_at)
            VALUES (existing_contact_id, 'telegram', lead_record.external_id, lead_record.created_at)
            ON CONFLICT (channel, external_id) DO NOTHING;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute migration (commented out by default - uncomment to run)
-- SELECT migrate_leads_to_target_model();

-- ============================================================================
-- PHASE 3: Update constraints
-- ============================================================================

-- Make contact_id NOT NULL after migration (optional - comment out if needed)
-- ALTER TABLE leads ALTER COLUMN contact_id SET NOT NULL;

-- ============================================================================
-- PHASE 4: Create helper functions
-- ============================================================================

-- Function: find_or_create_contact_by_telegram
-- Finds contact by telegram_user_id or creates new one
CREATE OR REPLACE FUNCTION find_or_create_contact_by_telegram(
    p_telegram_id VARCHAR(255),
    p_name VARCHAR(255) DEFAULT NULL,
    p_username VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_contact_id UUID;
    v_identity RECORD;
BEGIN
    -- Try to find existing contact by telegram identity
    SELECT ci.contact_id INTO v_contact_id
    FROM channel_identities ci
    WHERE ci.channel = 'telegram' AND ci.external_id = p_telegram_id
    LIMIT 1;

    -- If found, return it
    IF v_contact_id IS NOT NULL THEN
        -- Update name if provided and current is null
        IF p_name IS NOT NULL THEN
            UPDATE contacts SET
                name = COALESCE(name, p_name),
                updated_at = NOW()
            WHERE id = v_contact_id AND name IS NULL;
        END IF;

        RETURN v_contact_id;
    END IF;

    -- Create new contact
    INSERT INTO contacts (name, created_at, updated_at)
    VALUES (p_name, NOW(), NOW())
    RETURNING id INTO v_contact_id;

    -- Create channel identity
    INSERT INTO channel_identities (contact_id, channel, external_id, channel_data, created_at)
    VALUES (
        v_contact_id,
        'telegram',
        p_telegram_id,
        jsonb_build_object('username', p_username),
        NOW()
    );

    RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql;

-- Function: find_or_create_contact_by_email_phone
-- Finds contact by email or phone or creates new one
CREATE OR REPLACE FUNCTION find_or_create_contact_by_email_phone(
    p_email VARCHAR(255) DEFAULT NULL,
    p_phone VARCHAR(50) DEFAULT NULL,
    p_name VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_contact_id UUID;
BEGIN
    -- Try to find existing contact by email
    IF p_email IS NOT NULL AND p_email != '' THEN
        SELECT id INTO v_contact_id FROM contacts WHERE email = p_email LIMIT 1;
        IF v_contact_id IS NOT NULL THEN
            -- Update phone if provided and current is null
            IF p_phone IS NOT NULL AND p_phone != '' THEN
                UPDATE contacts SET
                    phone = COALESCE(phone, p_phone),
                    name = COALESCE(name, p_name),
                    updated_at = NOW()
                WHERE id = v_contact_id;
            END IF;
            RETURN v_contact_id;
        END IF;
    END IF;

    -- Try to find existing contact by phone
    IF p_phone IS NOT NULL AND p_phone != '' THEN
        SELECT id INTO v_contact_id FROM contacts WHERE phone = p_phone LIMIT 1;
        IF v_contact_id IS NOT NULL THEN
            -- Update email if provided and current is null
            IF p_email IS NOT NULL AND p_email != '' THEN
                UPDATE contacts SET
                    email = COALESCE(email, p_email),
                    name = COALESCE(name, p_name),
                    updated_at = NOW()
                WHERE id = v_contact_id;
            END IF;
            RETURN v_contact_id;
        END IF;
    END IF;

    -- Create new contact
    INSERT INTO contacts (name, phone, email, created_at, updated_at)
    VALUES (p_name, p_phone, p_email, NOW(), NOW())
    RETURNING id INTO v_contact_id;

    RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 5: Update triggers
-- ============================================================================

-- Trigger for contacts table
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for channel_identities table
DROP TRIGGER IF EXISTS update_channel_identities_updated_at ON channel_identities;
CREATE TRIGGER update_channel_identities_updated_at
    BEFORE UPDATE ON channel_identities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 6: Utility views for backward compatibility
-- ============================================================================

-- View: leads_with_contacts
-- Provides joined view for backward compatibility
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

COMMENT ON VIEW leads_with_contacts IS 'Backward-compatible view joining leads with contacts';

-- ============================================================================
-- PHASE 7: Diagnostic queries
-- ============================================================================

-- Query to check migration status
-- SELECT
--     (SELECT COUNT(*) FROM leads WHERE contact_id IS NULL) AS leads_without_contact,
--     (SELECT COUNT(*) FROM contacts) AS total_contacts,
--     (SELECT COUNT(*) FROM channel_identities) AS total_identities,
--     (SELECT COUNT(*) FROM channel_identities WHERE channel = 'telegram') AS telegram_identities;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================