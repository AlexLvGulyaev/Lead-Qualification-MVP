/**
 * Lead Qualification Assistant
 * Client UI - Lead Submission Form
 */

(function() {
    'use strict';

    // ========================================
    // State Management
    // ========================================

    const state = {
        currentStep: 1,
        totalSteps: 3,
        formData: {
            name: '',
            phone: '',
            email: '',
            message: '',
            source: '',
            utm_source: '',
            utm_campaign: ''
        },
        isValid: {
            step1: false,
            step2: false
        },
        isSubmitting: false,
        leadId: null
    };

    // ========================================
    // DOM Elements
    // ========================================

    const elements = {
        // Containers
        formContainer: document.getElementById('formContainer'),
        successContainer: document.getElementById('successContainer'),
        errorContainer: document.getElementById('errorContainer'),

        // Form
        form: document.getElementById('leadForm'),
        progressFill: document.getElementById('progressFill'),

        // Inputs
        name: document.getElementById('name'),
        phone: document.getElementById('phone'),
        email: document.getElementById('email'),
        message: document.getElementById('message'),
        source: document.getElementById('source'),

        // Hidden inputs
        utm_source: document.getElementById('utm_source'),
        utm_campaign: document.getElementById('utm_campaign'),

        // Buttons
        btnNext1: document.getElementById('btnNext1'),
        btnBack2: document.getElementById('btnBack2'),
        btnSubmit: document.getElementById('btnSubmit'),
        btnNewLead: document.getElementById('btnNewLead'),
        btnRetry: document.getElementById('btnRetry'),
        btnBackToForm: document.getElementById('btnBackToForm'),

        // Other elements
        charCount: document.getElementById('charCount'),
        contactRequirement: document.getElementById('contactRequirement'),
        messageValidation: document.getElementById('messageValidation'),
        leadId: document.getElementById('leadId'),
        errorMessage: document.getElementById('errorMessage')
    };

    // ========================================
    // Initialization
    // ========================================

    function init() {
        // Extract UTM parameters from URL
        extractUTMParams();

        // Setup event listeners
        setupEventListeners();

        // Update progress bar
        updateProgress();

        // Log configuration in debug mode
        if (CONFIG.DEBUG) {
            console.log('[Lead UI] Initialized');
            console.log('[Lead UI] Webhook URL:', CONFIG.WEBHOOK_URL);
            console.log('[Lead UI] UTM params:', {
                utm_source: state.formData.utm_source,
                utm_campaign: state.formData.utm_campaign
            });
        }
    }

    // ========================================
    // UTM Parameter Extraction
    // ========================================

    function extractUTMParams() {
        const urlParams = new URLSearchParams(window.location.search);

        state.formData.utm_source = urlParams.get('utm_source') || '';
        state.formData.utm_campaign = urlParams.get('utm_campaign') || '';

        // Update hidden inputs
        if (elements.utm_source) {
            elements.utm_source.value = state.formData.utm_source;
        }
        if (elements.utm_campaign) {
            elements.utm_campaign.value = state.formData.utm_campaign;
        }
    }

    // ========================================
    // Event Listeners
    // ========================================

    function setupEventListeners() {
        // Navigation buttons
        elements.btnNext1?.addEventListener('click', () => goToStep(2));
        elements.btnBack2?.addEventListener('click', () => goToStep(1));

        // Form submission
        elements.form?.addEventListener('submit', handleSubmit);

        // Success/Error actions
        elements.btnNewLead?.addEventListener('click', resetForm);
        elements.btnRetry?.addEventListener('click', retrySubmission);
        elements.btnBackToForm?.addEventListener('click', resetForm);

        // Real-time validation
        elements.phone?.addEventListener('input', validateContactInfo);
        elements.email?.addEventListener('input', validateContactInfo);
        elements.message?.addEventListener('input', handleMessageInput);
        elements.source?.addEventListener('change', handleSourceChange);

        // Name input (optional, no validation needed)
        elements.name?.addEventListener('input', (e) => {
            state.formData.name = e.target.value.trim();
        });
    }

    // ========================================
    // Step Navigation
    // ========================================

    function goToStep(step) {
        if (step === 2 && !validateStep1()) {
            return;
        }

        state.currentStep = step;
        updateStepDisplay();
        updateProgress();

        if (CONFIG.DEBUG) {
            console.log('[Lead UI] Go to step:', step);
        }
    }

    function updateStepDisplay() {
        // Hide all steps
        document.querySelectorAll('.form-step').forEach(el => {
            el.classList.remove('active');
        });

        // Show current step
        const currentStepEl = document.querySelector(`.form-step[data-step="${state.currentStep}"]`);
        currentStepEl?.classList.add('active');

        // Update progress indicators
        document.querySelectorAll('.step').forEach(el => {
            const stepNum = parseInt(el.dataset.step);
            el.classList.remove('active', 'completed');

            if (stepNum < state.currentStep) {
                el.classList.add('completed');
            } else if (stepNum === state.currentStep) {
                el.classList.add('active');
            }
        });
    }

    function updateProgress() {
        const progressPercent = ((state.currentStep - 1) / (state.totalSteps - 1)) * 100;
        elements.progressFill?.setAttribute('data-progress', Math.round(progressPercent));
        elements.progressFill?.setAttribute('style', `width: ${progressPercent}%`);
    }

    // ========================================
    // Validation
    // ========================================

    function validateStep1() {
        const hasPhone = state.formData.phone.trim().length > 0;
        const hasEmail = state.formData.email.trim().length > 0;

        if (!hasPhone && !hasEmail) {
            showContactRequirement();
            return false;
        }

        hideContactRequirement();
        return true;
    }

    function validateContactInfo() {
        state.formData.phone = elements.phone?.value.trim() || '';
        state.formData.email = elements.email?.value.trim() || '';

        const hasPhone = state.formData.phone.length > 0;
        const hasEmail = state.formData.email.length > 0;

        if (hasPhone || hasEmail) {
            hideContactRequirement();
            state.isValid.step1 = true;
        } else {
            state.isValid.step1 = false;
        }

        // Visual feedback
        if (hasPhone) {
            elements.phone?.classList.remove('error');
            elements.phone?.classList.add('success');
        } else {
            elements.phone?.classList.remove('success');
        }

        if (hasEmail) {
            elements.email?.classList.remove('error');
            elements.email?.classList.add('success');
        } else {
            elements.email?.classList.remove('success');
        }
    }

    function showContactRequirement() {
        elements.contactRequirement?.classList.add('visible');
        elements.phone?.classList.add('error');
        elements.email?.classList.add('error');
    }

    function hideContactRequirement() {
        elements.contactRequirement?.classList.remove('visible');
    }

    function handleMessageInput() {
        const message = elements.message?.value || '';
        state.formData.message = message;

        // Update character counter
        const count = message.length;
        if (elements.charCount) {
            elements.charCount.textContent = count;

            if (count >= CONFIG.VALIDATION.MAX_MESSAGE_LENGTH) {
                elements.charCount.parentElement?.classList.add('warning');
            } else {
                elements.charCount.parentElement?.classList.remove('warning');
            }
        }

        // Validate message length
        const isValid = count >= CONFIG.VALIDATION.MIN_MESSAGE_LENGTH;
        state.isValid.step2 = isValid;

        // Show validation message
        if (elements.messageValidation) {
            elements.messageValidation.classList.add('visible');

            if (count === 0) {
                elements.messageValidation.textContent = 'Минимум 10 символов';
                elements.messageValidation.classList.remove('success');
                elements.message?.classList.remove('success');
                elements.message?.classList.add('error');
            } else if (count < CONFIG.VALIDATION.MIN_MESSAGE_LENGTH) {
                elements.messageValidation.textContent = `Ещё ${CONFIG.VALIDATION.MIN_MESSAGE_LENGTH - count} символов`;
                elements.messageValidation.classList.remove('success');
                elements.message?.classList.remove('success');
                elements.message?.classList.add('error');
            } else {
                elements.messageValidation.textContent = '✓ Достаточно';
                elements.messageValidation.classList.add('success');
                elements.message?.classList.add('success');
                elements.message?.classList.remove('error');
            }
        }
    }

    function handleSourceChange() {
        state.formData.source = elements.source?.value || '';

        if (state.formData.source) {
            elements.source?.classList.add('success');
            elements.source?.classList.remove('error');
        } else {
            elements.source?.classList.remove('success');
        }
    }

    // ========================================
    // Form Submission
    // ========================================

    async function handleSubmit(e) {
        e.preventDefault();

        if (state.isSubmitting) {
            return;
        }

        // Validate before submission
        if (!validateBeforeSubmit()) {
            return;
        }

        // Collect form data
        collectFormData();

        // Submit to webhook
        await submitLead();
    }

    function validateBeforeSubmit() {
        // Check step 1 validation
        if (!validateStep1()) {
            goToStep(1);
            return false;
        }

        // Check message length
        if (state.formData.message.length < CONFIG.VALIDATION.MIN_MESSAGE_LENGTH) {
            elements.message?.focus();
            handleMessageInput();
            return false;
        }

        // Check source selection
        if (!state.formData.source) {
            elements.source?.classList.add('error');
            elements.source?.focus();
            return false;
        }

        return true;
    }

    function collectFormData() {
        state.formData.name = elements.name?.value.trim() || '';
        state.formData.phone = elements.phone?.value.trim() || '';
        state.formData.email = elements.email?.value.trim() || '';
        state.formData.message = elements.message?.value.trim();
        state.formData.source = elements.source?.value || '';

        if (CONFIG.DEBUG) {
            console.log('[Lead UI] Form data:', state.formData);
        }
    }

    async function submitLead() {
        state.isSubmitting = true;
        setButtonLoading(true);

        try {
            const response = await fetch(CONFIG.WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: state.formData.name,
                    phone: state.formData.phone,
                    email: state.formData.email,
                    message: state.formData.message,
                    source: state.formData.source,
                    utm_source: state.formData.utm_source,
                    utm_campaign: state.formData.utm_campaign
                }),
                signal: AbortSignal.timeout(CONFIG.API_TIMEOUT)
            });

            const data = await response.json();

            if (CONFIG.DEBUG) {
                console.log('[Lead UI] Response:', response.status, data);
            }

            if (response.ok && data.success) {
                // Success
                handleSuccess(data);
            } else {
                // Error from backend
                handleError(data.error || 'Ошибка сервера', response.status);
            }
        } catch (error) {
            // Network or other error
            if (CONFIG.DEBUG) {
                console.error('[Lead UI] Error:', error);
            }

            let errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';

            if (error.name === 'TimeoutError') {
                errorMessage = 'Превышено время ожидания. Попробуйте позже.';
            } else if (error.message?.includes('fetch')) {
                errorMessage = 'Не удалось подключиться к серверу. Попробуйте позже.';
            }

            handleError(errorMessage);
        } finally {
            state.isSubmitting = false;
            setButtonLoading(false);
        }
    }

    function handleSuccess(data) {
        state.leadId = data.public_number || data.lead_id;

        // Update success display
        elements.leadId.textContent = state.leadId || 'Не указан';

        // Show success container
        elements.formContainer.style.display = 'none';
        elements.errorContainer.style.display = 'none';
        elements.successContainer.style.display = 'block';

        if (CONFIG.DEBUG) {
            console.log('[Lead UI] Success! Public Number:', state.leadId);
        }
    }

    function handleError(message, statusCode) {
        elements.errorMessage.textContent = message;

        // Show error container
        elements.formContainer.style.display = 'none';
        elements.successContainer.style.display = 'none';
        elements.errorContainer.style.display = 'block';

        if (CONFIG.DEBUG) {
            console.error('[Lead UI] Error:', message, 'Status:', statusCode);
        }
    }

    function setButtonLoading(loading) {
        const btn = elements.btnSubmit;
        if (!btn) return;

        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
            btn.textContent = '';
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
            btn.innerHTML = `
                Отправить обращение
                <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        }
    }

    // ========================================
    // Reset & Retry
    // ========================================

    function resetForm() {
        // Reset state
        state.currentStep = 1;
        state.leadId = null;
        state.formData = {
            name: '',
            phone: '',
            email: '',
            message: '',
            source: '',
            utm_source: state.formData.utm_source,
            utm_campaign: state.formData.utm_campaign
        };

        // Reset form fields
        elements.form?.reset();

        // Reset validation states
        elements.phone?.classList.remove('success', 'error');
        elements.email?.classList.remove('success', 'error');
        elements.message?.classList.remove('success', 'error');
        elements.source?.classList.remove('success', 'error');

        // Hide validation messages
        elements.contactRequirement?.classList.remove('visible');
        elements.messageValidation?.classList.remove('visible');

        // Reset character counter
        if (elements.charCount) {
            elements.charCount.textContent = '0';
            elements.charCount.parentElement?.classList.remove('warning');
        }

        // Update display
        updateStepDisplay();
        updateProgress();

        // Show form container
        elements.successContainer.style.display = 'none';
        elements.errorContainer.style.display = 'none';
        elements.formContainer.style.display = 'block';

        if (CONFIG.DEBUG) {
            console.log('[Lead UI] Form reset');
        }
    }

    function retrySubmission() {
        // Go back to form with data intact
        elements.errorContainer.style.display = 'none';
        elements.formContainer.style.display = 'block';

        // Focus on submit button
        elements.btnSubmit?.focus();
    }

    // ========================================
    // Initialize
    // ========================================

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();