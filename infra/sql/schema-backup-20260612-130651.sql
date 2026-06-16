--
-- PostgreSQL database dump
--

\restrict vwcZ8dpCEJmVg39Olr7hn38LVuyCLKEPgxSldAcXd3Yd7fOd8w1kg3x4pSQthZ8

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: find_or_create_contact_by_email_phone(character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: n8n
--

CREATE FUNCTION public.find_or_create_contact_by_email_phone(p_email character varying DEFAULT NULL::character varying, p_phone character varying DEFAULT NULL::character varying, p_name character varying DEFAULT NULL::character varying) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.find_or_create_contact_by_email_phone(p_email character varying, p_phone character varying, p_name character varying) OWNER TO n8n;

--
-- Name: find_or_create_contact_by_telegram(character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: n8n
--

CREATE FUNCTION public.find_or_create_contact_by_telegram(p_telegram_id character varying, p_name character varying DEFAULT NULL::character varying, p_username character varying DEFAULT NULL::character varying) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.find_or_create_contact_by_telegram(p_telegram_id character varying, p_name character varying, p_username character varying) OWNER TO n8n;

--
-- Name: migrate_leads_to_target_model(); Type: FUNCTION; Schema: public; Owner: n8n
--

CREATE FUNCTION public.migrate_leads_to_target_model() RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.migrate_leads_to_target_model() OWNER TO n8n;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: n8n
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO n8n;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: channel_identities; Type: TABLE; Schema: public; Owner: n8n
--

CREATE TABLE public.channel_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    channel character varying(50) NOT NULL,
    external_id character varying(255) NOT NULL,
    channel_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.channel_identities OWNER TO n8n;

--
-- Name: TABLE channel_identities; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON TABLE public.channel_identities IS 'External identifiers in channels (Telegram, Web, etc.)';


--
-- Name: COLUMN channel_identities.channel; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.channel_identities.channel IS 'Channel name: telegram, web, whatsapp, etc.';


--
-- Name: COLUMN channel_identities.external_id; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.channel_identities.external_id IS 'ID in external system (e.g., telegram_user_id)';


--
-- Name: COLUMN channel_identities.channel_data; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.channel_identities.channel_data IS 'Additional channel-specific data (username, etc.)';


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: n8n
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255),
    phone character varying(50),
    email character varying(255),
    company character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contacts OWNER TO n8n;

--
-- Name: TABLE contacts; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON TABLE public.contacts IS 'Persons or organizations - the WHO behind leads';


--
-- Name: COLUMN contacts.id; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.contacts.id IS 'Internal unique identifier';


--
-- Name: COLUMN contacts.name; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.contacts.name IS 'Contact name (person or company)';


--
-- Name: COLUMN contacts.phone; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.contacts.phone IS 'Primary phone number';


--
-- Name: COLUMN contacts.email; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.contacts.email IS 'Primary email address';


--
-- Name: COLUMN contacts.company; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.contacts.company IS 'Company name (if B2B)';


--
-- Name: COLUMN contacts.notes; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.contacts.notes IS 'Additional notes about contact';


--
-- Name: crm_sync; Type: TABLE; Schema: public; Owner: n8n
--

CREATE TABLE public.crm_sync (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    crm_type character varying(50) NOT NULL,
    crm_lead_id character varying(100),
    sync_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    sync_error text,
    synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_crm_type CHECK (((crm_type)::text = ANY ((ARRAY['kommo'::character varying, 'bitrix24'::character varying])::text[]))),
    CONSTRAINT chk_sync_status CHECK (((sync_status)::text = ANY ((ARRAY['pending'::character varying, 'success'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.crm_sync OWNER TO n8n;

--
-- Name: TABLE crm_sync; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON TABLE public.crm_sync IS 'CRM synchronization tracking';


--
-- Name: COLUMN crm_sync.crm_type; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.crm_sync.crm_type IS 'CRM system: kommo, bitrix24';


--
-- Name: COLUMN crm_sync.crm_lead_id; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.crm_sync.crm_lead_id IS 'Lead ID in CRM';


--
-- Name: COLUMN crm_sync.sync_status; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.crm_sync.sync_status IS 'Sync status: pending, success, failed';


--
-- Name: follow_ups; Type: TABLE; Schema: public; Owner: n8n
--

CREATE TABLE public.follow_ups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    action_type character varying(50) NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    executed_at timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    result text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_action_type CHECK (((action_type)::text = ANY ((ARRAY['telegram_message'::character varying, 'crm_task'::character varying, 'email'::character varying])::text[]))),
    CONSTRAINT chk_follow_up_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'executed'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.follow_ups OWNER TO n8n;

--
-- Name: TABLE follow_ups; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON TABLE public.follow_ups IS 'Follow-up actions for leads';


--
-- Name: COLUMN follow_ups.action_type; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.follow_ups.action_type IS 'Action type: telegram_message, crm_task, email';


--
-- Name: COLUMN follow_ups.scheduled_at; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.follow_ups.scheduled_at IS 'Scheduled execution time';


--
-- Name: COLUMN follow_ups.executed_at; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.follow_ups.executed_at IS 'Actual execution time';


--
-- Name: leads; Type: TABLE; Schema: public; Owner: n8n
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_id character varying(255),
    source character varying(50) NOT NULL,
    name character varying(255),
    phone character varying(50),
    email character varying(255),
    status character varying(50) DEFAULT 'received'::character varying NOT NULL,
    utm_source character varying(100),
    utm_campaign character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_id uuid
);


ALTER TABLE public.leads OWNER TO n8n;

--
-- Name: TABLE leads; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON TABLE public.leads IS 'Individual requests/inquiries - the WHAT contacts want';


--
-- Name: COLUMN leads.id; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.leads.id IS 'Internal unique identifier';


--
-- Name: COLUMN leads.external_id; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.leads.external_id IS 'DEPRECATED: Use channel_identities table instead';


--
-- Name: COLUMN leads.source; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.leads.source IS 'Lead source: web, telegram';


--
-- Name: COLUMN leads.status; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.leads.status IS 'Lead status: received, qualified, processed, archived';


--
-- Name: COLUMN leads.contact_id; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.leads.contact_id IS 'Reference to the contact who made this request';


--
-- Name: leads_with_contacts; Type: VIEW; Schema: public; Owner: n8n
--

CREATE VIEW public.leads_with_contacts AS
 SELECT l.id,
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
   FROM (public.leads l
     LEFT JOIN public.contacts c ON ((l.contact_id = c.id)));


ALTER VIEW public.leads_with_contacts OWNER TO n8n;

--
-- Name: VIEW leads_with_contacts; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON VIEW public.leads_with_contacts IS 'Backward-compatible view joining leads with contacts';


--
-- Name: logs; Type: TABLE; Schema: public; Owner: n8n
--

CREATE TABLE public.logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid,
    event_type character varying(50) NOT NULL,
    event_data jsonb,
    status character varying(20) NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_log_status CHECK (((status)::text = ANY ((ARRAY['success'::character varying, 'error'::character varying, 'warning'::character varying])::text[])))
);


ALTER TABLE public.logs OWNER TO n8n;

--
-- Name: TABLE logs; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON TABLE public.logs IS 'System event logging for observability';


--
-- Name: COLUMN logs.event_type; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.logs.event_type IS 'Event type: lead_received, lead_classified, crm_sync, follow_up';


--
-- Name: COLUMN logs.event_data; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.logs.event_data IS 'JSON payload with event details';


--
-- Name: COLUMN logs.status; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.logs.status IS 'Event status: success, error, warning';


--
-- Name: messages; Type: TABLE; Schema: public; Owner: n8n
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    channel character varying(50) NOT NULL,
    direction character varying(20) NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.messages OWNER TO n8n;

--
-- Name: TABLE messages; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON TABLE public.messages IS 'All incoming and outgoing messages for leads';


--
-- Name: COLUMN messages.channel; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.messages.channel IS 'Message channel: web, telegram';


--
-- Name: COLUMN messages.direction; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.messages.direction IS 'Message direction: inbound, outbound';


--
-- Name: qualifications; Type: TABLE; Schema: public; Owner: n8n
--

CREATE TABLE public.qualifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    lead_type character varying(20) NOT NULL,
    interest character varying(20) NOT NULL,
    priority character varying(20) NOT NULL,
    category character varying(50),
    summary text,
    confidence numeric(3,2) NOT NULL,
    suggested_action character varying(50) NOT NULL,
    reasoning text,
    ai_model character varying(50) NOT NULL,
    processing_ms integer,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_interest CHECK (((interest)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT chk_lead_type CHECK (((lead_type)::text = ANY ((ARRAY['hot'::character varying, 'warm'::character varying, 'cold'::character varying, 'spam'::character varying])::text[]))),
    CONSTRAINT chk_priority CHECK (((priority)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT chk_suggested_action CHECK (((suggested_action)::text = ANY ((ARRAY['call'::character varying, 'email'::character varying, 'archive'::character varying, 'reject'::character varying])::text[]))),
    CONSTRAINT qualifications_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))
);


ALTER TABLE public.qualifications OWNER TO n8n;

--
-- Name: TABLE qualifications; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON TABLE public.qualifications IS 'AI classification results for each lead';


--
-- Name: COLUMN qualifications.lead_type; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.qualifications.lead_type IS 'Lead classification: hot, warm, cold, spam';


--
-- Name: COLUMN qualifications.confidence; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.qualifications.confidence IS 'Classification confidence score (0.00-1.00)';


--
-- Name: COLUMN qualifications.ai_model; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.qualifications.ai_model IS 'AI model used for classification';


--
-- Name: COLUMN qualifications.processing_ms; Type: COMMENT; Schema: public; Owner: n8n
--

COMMENT ON COLUMN public.qualifications.processing_ms IS 'Processing time in milliseconds';


--
-- Name: channel_identities channel_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.channel_identities
    ADD CONSTRAINT channel_identities_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: crm_sync crm_sync_pkey; Type: CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.crm_sync
    ADD CONSTRAINT crm_sync_pkey PRIMARY KEY (id);


--
-- Name: follow_ups follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: qualifications qualifications_pkey; Type: CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.qualifications
    ADD CONSTRAINT qualifications_pkey PRIMARY KEY (id);


--
-- Name: channel_identities uq_channel_identity; Type: CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.channel_identities
    ADD CONSTRAINT uq_channel_identity UNIQUE (channel, external_id);


--
-- Name: idx_channel_identities_channel; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_channel_identities_channel ON public.channel_identities USING btree (channel);


--
-- Name: idx_channel_identities_contact_id; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_channel_identities_contact_id ON public.channel_identities USING btree (contact_id);


--
-- Name: idx_channel_identities_external_id; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_channel_identities_external_id ON public.channel_identities USING btree (external_id);


--
-- Name: idx_contacts_created_at; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_contacts_created_at ON public.contacts USING btree (created_at);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (email);


--
-- Name: idx_contacts_phone; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_contacts_phone ON public.contacts USING btree (phone);


--
-- Name: idx_crm_sync_crm_type; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_crm_sync_crm_type ON public.crm_sync USING btree (crm_type);


--
-- Name: idx_crm_sync_lead_id; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_crm_sync_lead_id ON public.crm_sync USING btree (lead_id);


--
-- Name: idx_crm_sync_status; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_crm_sync_status ON public.crm_sync USING btree (sync_status);


--
-- Name: idx_crm_sync_synced_at; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_crm_sync_synced_at ON public.crm_sync USING btree (synced_at);


--
-- Name: idx_follow_ups_lead_id; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_follow_ups_lead_id ON public.follow_ups USING btree (lead_id);


--
-- Name: idx_follow_ups_scheduled_at; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_follow_ups_scheduled_at ON public.follow_ups USING btree (scheduled_at);


--
-- Name: idx_follow_ups_status; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_follow_ups_status ON public.follow_ups USING btree (status);


--
-- Name: idx_leads_contact_id; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_leads_contact_id ON public.leads USING btree (contact_id);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at);


--
-- Name: idx_leads_email; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_leads_email ON public.leads USING btree (email);


--
-- Name: idx_leads_phone; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_leads_phone ON public.leads USING btree (phone);


--
-- Name: idx_leads_source; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_leads_source ON public.leads USING btree (source);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_logs_created_at; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_logs_created_at ON public.logs USING btree (created_at);


--
-- Name: idx_logs_event_type; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_logs_event_type ON public.logs USING btree (event_type);


--
-- Name: idx_logs_lead_id; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_logs_lead_id ON public.logs USING btree (lead_id);


--
-- Name: idx_logs_status; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_logs_status ON public.logs USING btree (status);


--
-- Name: idx_messages_channel; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_messages_channel ON public.messages USING btree (channel);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: idx_messages_lead_id; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_messages_lead_id ON public.messages USING btree (lead_id);


--
-- Name: idx_qualifications_lead_id; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_qualifications_lead_id ON public.qualifications USING btree (lead_id);


--
-- Name: idx_qualifications_lead_type; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_qualifications_lead_type ON public.qualifications USING btree (lead_type);


--
-- Name: idx_qualifications_priority; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_qualifications_priority ON public.qualifications USING btree (priority);


--
-- Name: idx_qualifications_processed_at; Type: INDEX; Schema: public; Owner: n8n
--

CREATE INDEX idx_qualifications_processed_at ON public.qualifications USING btree (processed_at);


--
-- Name: channel_identities update_channel_identities_updated_at; Type: TRIGGER; Schema: public; Owner: n8n
--

CREATE TRIGGER update_channel_identities_updated_at BEFORE UPDATE ON public.channel_identities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: n8n
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: public; Owner: n8n
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: channel_identities channel_identities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.channel_identities
    ADD CONSTRAINT channel_identities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: crm_sync crm_sync_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.crm_sync
    ADD CONSTRAINT crm_sync_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: follow_ups follow_ups_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: logs logs_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: messages messages_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: qualifications qualifications_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: n8n
--

ALTER TABLE ONLY public.qualifications
    ADD CONSTRAINT qualifications_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict vwcZ8dpCEJmVg39Olr7hn38LVuyCLKEPgxSldAcXd3Yd7fOd8w1kg3x4pSQthZ8

