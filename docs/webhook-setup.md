# Webhook Setup Guide

## Overview

This guide explains how to set up and test the Lead Ingestion Webhook workflow.

---

## Prerequisites

1. Infrastructure is running (PostgreSQL + n8n)
2. n8n is accessible at `http://localhost:5678`
3. Database `lead_qualification` is created with business tables

---

## Step 1: Create PostgreSQL Credential

1. Open n8n UI: `http://localhost:5678`
2. Login with credentials from `.env`:
   - Username: `admin`
   - Password: (from `N8N_BASIC_AUTH_PASSWORD`)
3. Go to **Settings** → **Credentials**
4. Click **Add Credential**
5. Select **PostgreSQL**
6. Configure:
   - **Name:** `Lead Qualification DB`
   - **Host:** `postgres` (Docker network)
   - **Port:** `5432`
   - **Database:** `lead_qualification`
   - **Username:** `n8n`
   - **Password:** (from `POSTGRES_PASSWORD` in `.env`)
7. Click **Save**

---

## Step 2: Import Workflow

### Option A: Import JSON File

1. In n8n UI, go to **Workflows**
2. Click **Import from File**
3. Select: `workflow/n8n/workflows/lead-ingestion-webhook.json`
4. Click **Import**

### Option B: Create Manually

If import doesn't work, create nodes manually:

#### Node 1: Webhook Trigger

- **Type:** Webhook
- **HTTP Method:** POST
- **Path:** `lead`
- **Response Mode:** On Received
- **Response Data:** All Entries

#### Node 2: Validate & Normalize (Code)

```javascript
// Validation and Normalization
const body = $input.item.json.body || $input.item.json;

// Validate required fields
const errors = [];

// message is required and must be at least 10 characters
if (!body.message || body.message.trim().length < 10) {
  errors.push({
    field: 'message',
    message: 'Message is required and must be at least 10 characters'
  });
}

// phone or email is required
if (!body.phone && !body.email) {
  errors.push({
    field: 'phone',
    message: 'At least one of phone or email is required'
  });
}

// source is required
if (!body.source) {
  errors.push({
    field: 'source',
    message: 'Source is required'
  });
}

// Return validation result
if (errors.length > 0) {
  return { json: { valid: false, errors: errors } };
}

// Normalize data
const normalizedLead = {
  name: (body.name || '').trim().substring(0, 255),
  phone: (body.phone || '').trim().substring(0, 50),
  email: (body.email || '').trim().toLowerCase().substring(0, 255),
  message: body.message.trim(),
  source: body.source.trim().substring(0, 50),
  utm_source: (body.utm_source || '').trim().substring(0, 100),
  utm_campaign: (body.utm_campaign || '').trim().substring(0, 100),
  created_at: new Date().toISOString()
};

return { json: { valid: true, lead: normalizedLead } };
```

#### Node 3: If (Validation Check)

- **Condition:** `{{ $json.valid }}` equals `true`
- **True branch:** → Insert Lead
- **False branch:** → Error Response

#### Node 4: Insert Lead (PostgreSQL)

- **Operation:** Insert
- **Table:** `leads`
- **Columns:** Map from normalized lead
- **Return Fields:** `id`, `source`, `name`, `phone`, `email`, `status`, `created_at`

#### Node 5: Insert Message (PostgreSQL)

- **Operation:** Insert
- **Table:** `messages`
- **Columns:**
  - `lead_id`: `{{ $('Insert Lead').item.json.id }}`
  - `channel`: `web`
  - `direction`: `inbound`
  - `content`: `{{ $('Validate & Normalize').item.json.lead.message }}`

#### Node 6: Insert Log (PostgreSQL)

- **Operation:** Insert
- **Table:** `logs`
- **Columns:**
  - `lead_id`: `{{ $('Insert Lead').item.json.id }}`
  - `event_type`: `lead_received`
  - `event_data`: `{{ JSON.stringify({ source: $('Validate & Normalize').item.json.lead.source, channel: 'web' }) }}`
  - `status`: `success`

#### Node 7: Success Response (Respond to Webhook)

- **Response Code:** 200
- **Response Body:**
```json
{
  "success": true,
  "lead_id": "{{ $('Insert Lead').item.json.id }}",
  "message": "Lead received successfully",
  "created_at": "{{ $('Insert Lead').item.json.created_at }}"
}
```

#### Node 8: Error Response (Respond to Webhook)

- **Response Code:** 400
- **Response Body:**
```json
{
  "success": false,
  "error": "validation_error",
  "details": "{{ $json.errors }}"
}
```

---

## Step 3: Activate Workflow

1. Click **Save** workflow
2. Toggle **Active** switch to ON
3. Verify webhook URL appears in the Webhook Trigger node:
   - `http://localhost:5678/webhook/lead`

---

## Step 4: Test Webhook

### Using curl

```bash
# Test valid lead
curl -X POST http://localhost:5678/webhook/lead \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тестовый лид",
    "phone": "+79991234567",
    "email": "test@example.com",
    "message": "Хочу узнать подробнее о ваших услугах и возможностях.",
    "source": "test"
  }'
```

Expected response:
```json
{
  "success": true,
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Lead received successfully",
  "created_at": "2026-06-10T12:00:00.000Z"
}
```

### Using test script

```bash
cd tests/
chmod +x test-commands.sh
./test-commands.sh all
```

---

## Step 5: Verify Database

### Check leads table

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c \
  "SELECT id, source, name, phone, email, status, created_at FROM leads ORDER BY created_at DESC LIMIT 5;"
```

### Check messages table

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c \
  "SELECT m.id, l.name as lead_name, m.channel, m.direction, m.content FROM messages m JOIN leads l ON m.lead_id = l.id ORDER BY m.created_at DESC LIMIT 5;"
```

### Check logs table

```bash
docker compose exec postgres psql -U n8n -d lead_qualification -c \
  "SELECT id, event_type, status, created_at FROM logs ORDER BY created_at DESC LIMIT 10;"
```

---

## Troubleshooting

### Webhook returns 404

- Verify workflow is **Active**
- Check webhook path matches `/webhook/lead`

### Database connection error

- Verify PostgreSQL credential is correct
- Check database name is `lead_qualification` (not `n8n`)
- Test connection in credential settings

### Validation always fails

- Check request body is valid JSON
- Verify Content-Type header is `application/json`
- Enable debug mode in Code node to see input

### No response from webhook

- Check n8n execution log for errors
- Verify all nodes are connected correctly
- Check for missing credential references

---

## Webhook Contract

### Endpoint

```
POST /webhook/lead
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Contact name (max 255 chars) |
| `phone` | string | Conditional | Phone number (max 50 chars) |
| `email` | string | Conditional | Email address (max 255 chars) |
| `message` | string | Yes | Message content (min 10 chars) |
| `source` | string | Yes | Lead source identifier |
| `utm_source` | string | No | UTM source |
| `utm_campaign` | string | No | UTM campaign |

**Note:** At least one of `phone` or `email` is required.

### Success Response (200)

```json
{
  "success": true,
  "lead_id": "uuid",
  "message": "Lead received successfully",
  "created_at": "2026-06-10T12:00:00.000Z"
}
```

### Error Response (400)

```json
{
  "success": false,
  "error": "validation_error",
  "details": [
    {
      "field": "message",
      "message": "Message is required and must be at least 10 characters"
    }
  ]
}
```

---

## Related Files

- Workflow JSON: `workflow/n8n/workflows/lead-ingestion-webhook.json`
- Test payloads: `tests/test-payloads.json`
- Test commands: `tests/test-commands.sh`
- Implementation plan: `docs/IMPLEMENTATION_PLAN.md`