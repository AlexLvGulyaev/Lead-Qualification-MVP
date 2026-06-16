/**
 * Lead Qualification Assistant
 * Client UI Configuration
 *
 * Configure webhook endpoint for lead submission
 */

const CONFIG = {
    // Webhook endpoint for lead submission
    // Replace with your actual n8n webhook URL
    // Format: http://your-n8n-host:5678/webhook/lead
    WEBHOOK_URL: 'https://lead-qual.alex-n8n.site/webhook/lead',

    // API timeout in milliseconds
    API_TIMEOUT: 30000,

    // Form validation
    VALIDATION: {
        MIN_MESSAGE_LENGTH: 10,
        MAX_MESSAGE_LENGTH: 2000
    },

    // Source options for the dropdown
    // Must match values accepted by backend
    SOURCES: [
        { value: 'website', label: 'Сайт компании' },
        { value: 'recommendation', label: 'Рекомендация' },
        { value: 'social_media', label: 'Социальные сети' },
        { value: 'search', label: 'Поиск в интернете' },
        { value: 'advertising', label: 'Реклама' },
        { value: 'other', label: 'Другое' }
    ],

    // Debug mode (log to console)
    DEBUG: true
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.VALIDATION);
Object.freeze(CONFIG.SOURCES);

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}