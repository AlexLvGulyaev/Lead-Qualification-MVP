# CRM Field Mapping
## Phase 006 — Data Field Mapping

**Версия:** 1.0
**Дата:** 2026-06-12
**Статус:** Design Phase
**Автор:** AI Automation Portfolio Lab

---

## Содержание

1. [Overview](#1-overview)
2. [Unified Payload Structure](#2-unified-payload-structure)
3. [Kommo Field Mapping](#3-kommo-field-mapping)
4. [Bitrix24 Field Mapping](#4-bitrix24-field-mapping)
5. [Custom Fields](#5-custom-fields)
6. [Status Mapping](#6-status-mapping)
7. [Notes & Comments](#7-notes--comments)
8. [Implementation Notes](#8-implementation-notes)

---

## 1. Overview

### 1.1. Цель

Определить маппинг полей между:
- **Unified Payload** — внутренний формат Lead Qualification Assistant
- **Kommo CRM** — API v4
- **Bitrix24 CRM** — REST API

### 1.2. Принципы

1. **Unified Payload → CRM** — все провайдеры получают одинаковый payload
2. **Provider Mapping** — каждый провайдер маппит поля согласно API CRM
3. **Required Fields** — обязательные поля гарантированы в Unified Payload
4. **Custom Fields** — кастомные поля определяются отдельно

### 1.3. Источники данных

```
┌─────────────────────────────────────────────────────────────────┐
│                    Unified Payload Sources                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  contacts ──────────────────┐                                   │
│       │                     │                                   │
│       ├─ name              ──┼──▶ contact.name                   │
│       ├─ phone             ──┼──▶ contact.phone                  │
│       ├─ email             ──┼──▶ contact.email                  │
│       ├─ company           ──┼──▶ contact.company               │
│       └─ notes             ──┼──▶ contact.notes                   │
│                             │                                   │
│  channel_identities ───────┼──▶ channel_identities[]             │
│       │                     │                                   │
│       ├─ channel           ──┼──▶ .channel                        │
│       ├─ external_id       ──┼──▶ .external_id                    │
│       └─ channel_data      ──┼──▶ .channel_data                   │
│                             │                                   │
│  leads ─────────────────────┼──▶ lead_id, public_number, source │
│       │                     │                                   │
│       ├─ public_number     ──┼──▶ public_number                   │
│       ├─ source            ──┼──▶ source.channel                  │
│       ├─ utm_source        ──┼──▶ source.utm_source               │
│       └─ utm_campaign      ──┼──▶ source.utm_campaign             │
│                             │                                   │
│  qualifications ───────────┼──▶ qualification                   │
│       │                     │                                   │
│       ├─ lead_type         ──┼──▶ .lead_type                      │
│       ├─ interest          ──┼──▶ .interest                       │
│       ├─ priority          ──┼──▶ .priority                       │
│       ├─ summary           ──┼──▶ .summary                        │
│       ├─ confidence        ──┼──▶ .confidence                      │
│       └─ suggested_action  ──┼──▶ .suggested_action               │
│                             │                                   │
│  messages ──────────────────┘                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Unified Payload Structure

### 2.1. Complete Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["lead_id", "public_number", "contact", "qualification"],
  "properties": {
    "lead_id": {
      "type": "string",
      "format": "uuid",
      "description": "Internal lead ID"
    },
    "public_number": {
      "type": "string",
      "pattern": "^LQ-[0-9]{6}$",
      "description": "Human-readable lead number"
    },
    "contact": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": {
          "type": "string",
          "description": "Contact name"
        },
        "phone": {
          "type": ["string", "null"],
          "description": "Contact phone"
        },
        "email": {
          "type": ["string", "null"],
          "description": "Contact email"
        },
        "company": {
          "type": ["string", "null"],
          "description": "Company name"
        },
        "notes": {
          "type": ["string", "null"],
          "description": "Additional notes"
        }
      }
    },
    "channel_identities": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "channel": {
            "type": "string",
            "enum": ["web", "telegram", "email", "phone"]
          },
          "external_id": {
            "type": "string"
          },
          "channel_data": {
            "type": ["object", "null"]
          }
        }
      }
    },
    "qualification": {
      "type": "object",
      "required": ["lead_type", "priority", "confidence"],
      "properties": {
        "lead_type": {
          "type": "string",
          "enum": ["hot", "warm", "cold", "spam"]
        },
        "interest": {
          "type": "string",
          "enum": ["high", "medium", "low"]
        },
        "priority": {
          "type": "string",
          "enum": ["high", "medium", "low"]
        },
        "category": {
          "type": ["string", "null"]
        },
        "summary": {
          "type": "string"
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "suggested_action": {
          "type": "string",
          "enum": ["call", "email", "archive", "reject"]
        },
        "reasoning": {
          "type": ["string", "null"]
        },
        "ai_model": {
          "type": "string"
        },
        "processed_at": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "source": {
      "type": "object",
      "properties": {
        "channel": {
          "type": "string",
          "enum": ["web", "telegram"]
        },
        "utm_source": {
          "type": ["string", "null"]
        },
        "utm_campaign": {
          "type": ["string", "null"]
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "created_at": {
          "type": "string",
          "format": "date-time"
        },
        "first_message": {
          "type": "string"
        }
      }
    }
  }
}
```

### 2.2. Example Payload

```json
{
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "public_number": "LQ-123456",
  "contact": {
    "name": "Иван Петров",
    "phone": "+79991234567",
    "email": "ivan@example.com",
    "company": "ООО Рога и Копыта",
    "notes": null
  },
  "channel_identities": [
    {
      "channel": "telegram",
      "external_id": "123456789",
      "channel_data": {
        "username": "ivan_petrov",
        "first_name": "Иван",
        "last_name": "Петров"
      }
    }
  ],
  "qualification": {
    "lead_type": "hot",
    "interest": "high",
    "priority": "high",
    "category": "service_a",
    "summary": "Клиент готов к покупке, интересует срочная доставка",
    "confidence": 0.92,
    "suggested_action": "call",
    "reasoning": "Упоминает конкретные сроки и готовность оплатить",
    "ai_model": "gpt-4o-mini",
    "processed_at": "2026-06-12T14:30:00Z"
  },
  "source": {
    "channel": "telegram",
    "utm_source": null,
    "utm_campaign": null
  },
  "metadata": {
    "created_at": "2026-06-12T14:25:00Z",
    "first_message": "Хочу купить вашу услугу, нужно срочно!"
  }
}
```

---

## 3. Kommo Field Mapping

### 3.1. Standard Fields

| Unified Field | Kommo Field | Type | Required | Notes |
|---------------|-------------|------|----------|-------|
| `contact.name` | `name` | string | ✅ | Lead name |
| `contact.phone` | `custom_fields_values[PHONE]` | string | ❌ | Contact phone |
| `contact.email` | `custom_fields_values[EMAIL]` | string | ❌ | Contact email |
| `contact.company` | `_embedded.contacts[0].company` | string | ❌ | Company name |
| `public_number` | `custom_fields_values[PUBLIC_NUMBER]` | string | ✅ | LQ-NNNNNN |
| `source.channel` | `source_id` | enum | ❌ | WEB, TELEGRAM |
| `metadata.first_message` | `_embedded.notes[0].params.text` | string | ❌ | First message |
| `lead_id` | `_embedded.notes[0].params.text` | string | ✅ | Added to note |

### 3.2. Custom Fields (Kommo)

| Unified Field | Kommo Custom Field ID | Type | Required |
|---------------|----------------------|------|----------|
| `qualification.lead_type` | `{LEAD_TYPE_FIELD_ID}` | enum | ✅ |
| `qualification.priority` | `{PRIORITY_FIELD_ID}` | enum | ✅ |
| `qualification.confidence` | `{CONFIDENCE_FIELD_ID}` | numeric | ✅ |
| `qualification.category` | `{CATEGORY_FIELD_ID}` | string | ❌ |
| `qualification.suggested_action` | `{ACTION_FIELD_ID}` | enum | ❌ |
| `public_number` | `{PUBLIC_NUMBER_FIELD_ID}` | text | ✅ |

**Примечание:** `{FIELD_ID}` — ID кастомных полей, определяется в настройках Kommo.

### 3.3. Status Mapping (Kommo)

| Unified `lead_type` | Kommo Pipeline Status | Notes |
|--------------------|----------------------|-------|
| `hot` | `{HOT_STATUS_ID}` | First contact, high priority |
| `warm` | `{WARM_STATUS_ID}` | Needs follow-up |
| `cold` | `{COLD_STATUS_ID}` | Archive or nurture |
| `spam` | `{SPAM_STATUS_ID}` | Rejected |

### 3.4. Kommo API Payload

**Create Lead (POST /api/v4/leads):**

```json
{
  "name": "Иван Петров",
  "price": 0,
  "pipeline_id": 12345,
  "status_id": 54281961,
  "source_id": 1,
  "custom_fields_values": [
    {
      "field_id": 123456,
      "field_name": "Lead Type",
      "values": [{ "value": "hot" }]
    },
    {
      "field_id": 123457,
      "field_name": "Priority",
      "values": [{ "value": "high" }]
    },
    {
      "field_id": 123458,
      "field_name": "Confidence",
      "values": [{ "value": "0.92" }]
    },
    {
      "field_id": 123459,
      "field_name": "Public Number",
      "values": [{ "value": "LQ-123456" }]
    }
  ],
  "_embedded": {
    "contacts": [
      {
        "first_name": "Иван",
        "last_name": "Петров",
        "company": "ООО Рога и Копыта",
        "custom_fields_values": [
          {
            "field_code": "PHONE",
            "values": [{ "value": "+79991234567", "enum_code": "WORK" }]
          },
          {
            "field_code": "EMAIL",
            "values": [{ "value": "ivan@example.com", "enum_code": "WORK" }]
          }
        ]
      }
    ],
    "notes": [
      {
        "note_type": "common",
        "params": {
          "text": "AI Classification: hot (confidence: 0.92)\n\nSummary: Клиент готов к покупке, интересует срочная доставка\n\nReasoning: Упоминает конкретные сроки и готовность оплатить\n\n---\nLead ID: 550e8400-e29b-41d4-a716-446655440000\nFirst Message: Хочу купить вашу услугу, нужно срочно!"
        }
      }
    ]
  }
}
```

### 3.5. Kommo Provider Implementation

```javascript
class KommoProvider {
  constructor(config) {
    this.accessToken = config.accessToken;
    this.subdomain = config.subdomain;
    this.pipelineId = config.pipelineId;
    this.customFields = config.customFields; // Field ID mapping
  }

  async createLead(payload) {
    const kommoPayload = this.mapPayload(payload);
    
    const response = await fetch(
      `https://${this.subdomain}.amocrm.ru/api/v4/leads`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(kommoPayload)
      }
    );

    if (!response.ok) {
      throw this.handleError(response);
    }

    const data = await response.json();
    return {
      success: true,
      crmLeadId: data._embedded.leads[0].id
    };
  }

  mapPayload(payload) {
    return {
      name: payload.contact.name || 'Неизвестный контакт',
      price: 0,
      pipeline_id: this.pipelineId,
      status_id: this.getStatusId(payload.qualification.lead_type),
      source_id: this.getSourceId(payload.source.channel),
      custom_fields_values: [
        {
          field_id: this.customFields.leadType,
          values: [{ value: payload.qualification.lead_type }]
        },
        {
          field_id: this.customFields.priority,
          values: [{ value: payload.qualification.priority }]
        },
        {
          field_id: this.customFields.confidence,
          values: [{ value: payload.qualification.confidence.toString() }]
        },
        {
          field_id: this.customFields.publicNumber,
          values: [{ value: payload.public_number }]
        }
      ],
      _embedded: {
        contacts: [
          {
            first_name: this.extractFirstName(payload.contact.name),
            last_name: this.extractLastName(payload.contact.name),
            company: payload.contact.company,
            custom_fields_values: this.mapContactFields(payload.contact)
          }
        ],
        notes: [
          {
            note_type: 'common',
            params: {
              text: this.buildNote(payload)
            }
          }
        ]
      }
    };
  }

  buildNote(payload) {
    return `AI Classification: ${payload.qualification.lead_type} (confidence: ${payload.qualification.confidence})

Summary: ${payload.qualification.summary}

Reasoning: ${payload.qualification.reasoning}

---
Lead ID: ${payload.lead_id}
Public Number: ${payload.public_number}
First Message: ${payload.metadata.first_message}`;
  }

  getStatusId(leadType) {
    const statusMap = {
      hot: this.customFields.statusHot,
      warm: this.customFields.statusWarm,
      cold: this.customFields.statusCold,
      spam: this.customFields.statusSpam
    };
    return statusMap[leadType];
  }

  getSourceId(channel) {
    const sourceMap = {
      web: 1,    // WEB
      telegram: 2 // TELEGRAM
    };
    return sourceMap[channel] || 1;
  }

  mapContactFields(contact) {
    const fields = [];
    
    if (contact.phone) {
      fields.push({
        field_code: 'PHONE',
        values: [{ value: contact.phone, enum_code: 'WORK' }]
      });
    }
    
    if (contact.email) {
      fields.push({
        field_code: 'EMAIL',
        values: [{ value: contact.email, enum_code: 'WORK' }]
      });
    }
    
    return fields;
  }

  extractFirstName(name) {
    const parts = (name || '').split(' ');
    return parts[0] || '';
  }

  extractLastName(name) {
    const parts = (name || '').split(' ');
    return parts.slice(1).join(' ') || '';
  }
}
```

---

## 4. Bitrix24 Field Mapping

### 4.1. Standard Fields

| Unified Field | Bitrix24 Field | Type | Required | Notes |
|---------------|---------------|------|----------|-------|
| `contact.name` | `NAME` + `LAST_NAME` | string | ✅ | Split by space |
| `contact.phone` | `PHONE[].VALUE` | string | ❌ | Phone array |
| `contact.email` | `EMAIL[].VALUE` | string | ❌ | Email array |
| `contact.company` | `COMPANY_TITLE` | string | ❌ | Company name |
| `public_number` | `UF_CRM_PUBLIC_NUMBER` | string | ✅ | Custom field |
| `source.channel` | `SOURCE_ID` | enum | ❌ | WEB, TELEGRAM, etc. |
| `metadata.first_message` | `COMMENTS` | string | ❌ | First message |

### 4.2. Custom Fields (Bitrix24)

| Unified Field | Bitrix24 Custom Field | Type | Required |
|---------------|----------------------|------|----------|
| `qualification.lead_type` | `UF_CRM_LEAD_TYPE` | enumeration | ✅ |
| `qualification.priority` | `UF_CRM_PRIORITY` | enumeration | ✅ |
| `qualification.confidence` | `UF_CRM_CONFIDENCE` | double | ✅ |
| `qualification.category` | `UF_CRM_CATEGORY` | string | ❌ |
| `qualification.suggested_action` | `UF_CRM_ACTION` | enumeration | ❌ |
| `public_number` | `UF_CRM_PUBLIC_NUMBER` | string | ✅ |

### 4.3. Status Mapping (Bitrix24)

| Unified `lead_type` | Bitrix24 Status ID | Notes |
|--------------------|-------------------|-------|
| `hot` | `NEW` | New lead, high priority |
| `warm` | `IN_PROCESS` | In progress |
| `cold` | `JUNK` | Archive |
| `spam` | `JUNK` | Rejected |

### 4.4. Bitrix24 API Payload

**Create Lead (POST /rest/1/{webhook}/crm.lead.add):**

```json
{
  "fields": {
    "TITLE": "Лид от Иван Петров",
    "NAME": "Иван",
    "LAST_NAME": "Петров",
    "PHONE": [
      {
        "VALUE": "+79991234567",
        "VALUE_TYPE": "WORK"
      }
    ],
    "EMAIL": [
      {
        "VALUE": "ivan@example.com",
        "VALUE_TYPE": "WORK"
      }
    ],
    "COMPANY_TITLE": "ООО Рога и Копыта",
    "SOURCE_ID": "TELEGRAM",
    "STATUS_ID": "NEW",
    "COMMENTS": "AI Classification: hot (confidence: 0.92)\n\nSummary: Клиент готов к покупке\n\nFirst Message: Хочу купить вашу услугу, нужно срочно!",
    "UF_CRM_LEAD_TYPE": "hot",
    "UF_CRM_PRIORITY": "high",
    "UF_CRM_CONFIDENCE": 0.92,
    "UF_CRM_PUBLIC_NUMBER": "LQ-123456"
  }
}
```

### 4.5. Bitrix24 Provider Implementation

```javascript
class Bitrix24Provider {
  constructor(config) {
    this.webhookUrl = config.webhookUrl;
    this.customFields = config.customFields;
  }

  async createLead(payload) {
    const bitrixPayload = this.mapPayload(payload);
    
    const response = await fetch(
      `${this.webhookUrl}/crm.lead.add`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bitrixPayload)
      }
    );

    if (!response.ok) {
      throw this.handleError(response);
    }

    const data = await response.json();
    
    if (!data.result) {
      throw new Error(data.error_description || 'Unknown error');
    }

    return {
      success: true,
      crmLeadId: data.result.toString()
    };
  }

  mapPayload(payload) {
    return {
      fields: {
        TITLE: `Лид от ${payload.contact.name || 'Неизвестный контакт'}`,
        NAME: this.extractFirstName(payload.contact.name),
        LAST_NAME: this.extractLastName(payload.contact.name),
        PHONE: payload.contact.phone ? [
          { VALUE: payload.contact.phone, VALUE_TYPE: 'WORK' }
        ] : [],
        EMAIL: payload.contact.email ? [
          { VALUE: payload.contact.email, VALUE_TYPE: 'WORK' }
        ] : [],
        COMPANY_TITLE: payload.contact.company || '',
        SOURCE_ID: this.getSourceId(payload.source.channel),
        STATUS_ID: this.getStatusId(payload.qualification.lead_type),
        COMMENTS: this.buildComment(payload),
        UF_CRM_LEAD_TYPE: payload.qualification.lead_type,
        UF_CRM_PRIORITY: payload.qualification.priority,
        UF_CRM_CONFIDENCE: payload.qualification.confidence,
        UF_CRM_PUBLIC_NUMBER: payload.public_number
      }
    };
  }

  buildComment(payload) {
    return `AI Classification: ${payload.qualification.lead_type} (confidence: ${payload.qualification.confidence})

Summary: ${payload.qualification.summary}

Reasoning: ${payload.qualification.reasoning}

---
Lead ID: ${payload.lead_id}
Public Number: ${payload.public_number}
First Message: ${payload.metadata.first_message}`;
  }

  getStatusId(leadType) {
    const statusMap = {
      hot: 'NEW',
      warm: 'IN_PROCESS',
      cold: 'JUNK',
      spam: 'JUNK'
    };
    return statusMap[leadType] || 'NEW';
  }

  getSourceId(channel) {
    const sourceMap = {
      web: 'WEB',
      telegram: 'TELEGRAM'
    };
    return sourceMap[channel] || 'WEB';
  }

  extractFirstName(name) {
    const parts = (name || '').split(' ');
    return parts[0] || 'Неизвестный';
  }

  extractLastName(name) {
    const parts = (name || '').split(' ');
    return parts.slice(1).join(' ') || '';
  }
}
```

---

## 5. Custom Fields

### 5.1. Kommo Custom Fields

**Required Setup:**

1. **Lead Type Field** (`LEAD_TYPE_FIELD_ID`)
   - Type: Enumeration
   - Values: hot, warm, cold, spam

2. **Priority Field** (`PRIORITY_FIELD_ID`)
   - Type: Enumeration
   - Values: high, medium, low

3. **Confidence Field** (`CONFIDENCE_FIELD_ID`)
   - Type: Numeric
   - Values: 0.00 - 1.00

4. **Public Number Field** (`PUBLIC_NUMBER_FIELD_ID`)
   - Type: Text
   - Values: LQ-NNNNNN

5. **Category Field** (`CATEGORY_FIELD_ID`) - Optional
   - Type: Text

6. **Suggested Action Field** (`ACTION_FIELD_ID`) - Optional
   - Type: Enumeration
   - Values: call, email, archive, reject

### 5.2. Bitrix24 Custom Fields

**Required Setup:**

1. **UF_CRM_LEAD_TYPE**
   - Type: Enumeration
   - Values: hot, warm, cold, spam

2. **UF_CRM_PRIORITY**
   - Type: Enumeration
   - Values: high, medium, low

3. **UF_CRM_CONFIDENCE**
   - Type: Double
   - Values: 0.00 - 1.00

4. **UF_CRM_PUBLIC_NUMBER**
   - Type: String
   - Values: LQ-NNNNNN

5. **UF_CRM_CATEGORY** - Optional
   - Type: String

6. **UF_CRM_ACTION** - Optional
   - Type: Enumeration
   - Values: call, email, archive, reject

---

## 6. Status Mapping

### 6.1. Unified → Kommo Status

| Unified `lead_type` | Unified `priority` | Kommo Pipeline Status | Notes |
|--------------------|-------------------|----------------------|-------|
| `hot` | `high` | `{HOT_STATUS_ID}` | Immediate attention |
| `hot` | `medium` | `{HOT_STATUS_ID}` | High priority |
| `hot` | `low` | `{WARM_STATUS_ID}` | Still hot |
| `warm` | `high` | `{WARM_STATUS_ID}` | Needs follow-up |
| `warm` | `medium` | `{WARM_STATUS_ID}` | Standard follow-up |
| `warm` | `low` | `{COLD_STATUS_ID}` | Low priority warm |
| `cold` | any | `{COLD_STATUS_ID}` | Archive |
| `spam` | any | `{SPAM_STATUS_ID}` | Rejected |

### 6.2. Unified → Bitrix24 Status

| Unified `lead_type` | Unified `priority` | Bitrix24 Status | Notes |
|--------------------|-------------------|----------------|-------|
| `hot` | `high` | `NEW` | New lead |
| `hot` | `medium` | `NEW` | New lead |
| `hot` | `low` | `IN_PROCESS` | In progress |
| `warm` | any | `IN_PROCESS` | In progress |
| `cold` | any | `JUNK` | Archive |
| `spam` | any | `JUNK` | Rejected |

### 6.3. Status ID Resolution

**Kommo:** Pipeline и Status ID определяются в настройках CRM.

```javascript
// Configuration
const KOMMO_PIPELINE_ID = process.env.KOMMO_PIPELINE_ID;
const KOMMO_STATUS_HOT = process.env.KOMMO_STATUS_HOT;
const KOMMO_STATUS_WARM = process.env.KOMMO_STATUS_WARM;
const KOMMO_STATUS_COLD = process.env.KOMMO_STATUS_COLD;
const KOMMO_STATUS_SPAM = process.env.KOMMO_STATUS_SPAM;
```

**Bitrix24:** Status ID — стандартные (NEW, IN_PROCESS, JUNK, etc.)

---

## 7. Notes & Comments

### 7.1. Note Structure

**Unified Note Format:**

```
AI Classification: {lead_type} (confidence: {confidence})

Summary: {summary}

Reasoning: {reasoning}

---
Lead ID: {lead_id}
Public Number: {public_number}
Channel: {source.channel}
First Message: {metadata.first_message}
```

### 7.2. Kommo Note

```json
{
  "note_type": "common",
  "params": {
    "text": "AI Classification: hot (confidence: 0.92)\n\nSummary: Клиент готов к покупке\n\nReasoning: Упоминает конкретные сроки\n\n---\nLead ID: 550e8400-e29b-41d4-a716-446655440000\nPublic Number: LQ-123456\nChannel: telegram\nFirst Message: Хочу купить вашу услугу, нужно срочно!"
  }
}
```

### 7.3. Bitrix24 Comment

```json
{
  "fields": {
    "COMMENTS": "AI Classification: hot (confidence: 0.92)\n\nSummary: Клиент готов к покупке\n\nReasoning: Упоминает конкретные сроки\n\n---\nLead ID: 550e8400-e29b-41d4-a716-446655440000\nPublic Number: LQ-123456\nChannel: telegram\nFirst Message: Хочу купить вашу услугу, нужно срочно!"
  }
}
```

---

## 8. Implementation Notes

### 8.1. Provider Factory

```javascript
function getCRMProvider(type, config) {
  switch (type) {
    case 'kommo':
      return new KommoProvider(config);
    case 'bitrix24':
      return new Bitrix24Provider(config);
    default:
      throw new Error(`Unknown CRM provider: ${type}`);
  }
}

// Usage
const provider = getCRMProvider(process.env.CRM_PROVIDER, {
  // Kommo config
  accessToken: process.env.KOMMO_ACCESS_TOKEN,
  subdomain: process.env.KOMMO_SUBDOMAIN,
  pipelineId: process.env.KOMMO_PIPELINE_ID,
  customFields: {
    leadType: process.env.KOMMO_LEAD_TYPE_FIELD_ID,
    priority: process.env.KOMMO_PRIORITY_FIELD_ID,
    confidence: process.env.KOMMO_CONFIDENCE_FIELD_ID,
    publicNumber: process.env.KOMMO_PUBLIC_NUMBER_FIELD_ID,
    statusHot: process.env.KOMMO_STATUS_HOT,
    statusWarm: process.env.KOMMO_STATUS_WARM,
    statusCold: process.env.KOMMO_STATUS_COLD,
    statusSpam: process.env.KOMMO_STATUS_SPAM
  }
});
```

### 8.2. Environment Variables

```bash
# Provider Selection
CRM_PROVIDER=kommo  # or bitrix24

# Kommo Configuration
KOMMO_ACCESS_TOKEN=***
KOMMO_SUBDOMAIN=yourcompany
KOMMO_PIPELINE_ID=12345
KOMMO_LEAD_TYPE_FIELD_ID=123456
KOMMO_PRIORITY_FIELD_ID=123457
KOMMO_CONFIDENCE_FIELD_ID=123458
KOMMO_PUBLIC_NUMBER_FIELD_ID=123459
KOMMO_STATUS_HOT=54281961
KOMMO_STATUS_WARM=54281962
KOMMO_STATUS_COLD=54281963
KOMMO_STATUS_SPAM=54281964

# Bitrix24 Configuration
BITRIX24_WEBHOOK_URL=https://yourcompany.bitrix24.ru/rest/1***/
```

### 8.3. Configuration Checklist

**Kommo Setup:**

- [ ] Create Pipeline for Lead Qualification
- [ ] Create Statuses: Hot, Warm, Cold, Spam
- [ ] Create Custom Fields: Lead Type, Priority, Confidence, Public Number
- [ ] Get Access Token
- [ ] Note Pipeline ID and Status IDs
- [ ] Note Custom Field IDs

**Bitrix24 Setup:**

- [ ] Create Custom Fields: UF_CRM_LEAD_TYPE, UF_CRM_PRIORITY, UF_CRM_CONFIDENCE, UF_CRM_PUBLIC_NUMBER
- [ ] Create Incoming Webhook
- [ ] Note Webhook URL

---

## Приложение A: Field Mapping Summary

### A.1. Contact Fields

| Unified | Kommo | Bitrix24 |
|---------|-------|----------|
| `contact.name` | `name` | `NAME` + `LAST_NAME` |
| `contact.phone` | `custom_fields_values[PHONE]` | `PHONE[].VALUE` |
| `contact.email` | `custom_fields_values[EMAIL]` | `EMAIL[].VALUE` |
| `contact.company` | `_embedded.contacts[0].company` | `COMPANY_TITLE` |

### A.2. Qualification Fields

| Unified | Kommo | Bitrix24 |
|---------|-------|----------|
| `qualification.lead_type` | `custom_fields_values[LEAD_TYPE]` | `UF_CRM_LEAD_TYPE` |
| `qualification.priority` | `custom_fields_values[PRIORITY]` | `UF_CRM_PRIORITY` |
| `qualification.confidence` | `custom_fields_values[CONFIDENCE]` | `UF_CRM_CONFIDENCE` |
| `qualification.summary` | `_embedded.notes[0].params.text` | `COMMENTS` |

### A.3. System Fields

| Unified | Kommo | Bitrix24 |
|---------|-------|----------|
| `lead_id` | `_embedded.notes[0].params.text` | `COMMENTS` |
| `public_number` | `custom_fields_values[PUBLIC_NUMBER]` | `UF_CRM_PUBLIC_NUMBER` |
| `source.channel` | `source_id` | `SOURCE_ID` |

---

**Конец документа**

*Документ разработан в рамках Phase 006 CRM Integration Design*
*Дата: 2026-06-12*