/**
 * n8n Lead Qualification Assistant
 * Landing Page JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initDashboardAnimation();
    initStatCounters();
    initSmoothScroll();
});

/**
 * Scroll Reveal Animation
 * Animates elements as they come into view
 */
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.problem-card, .feature-card, .flow-step, .result-card');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Stagger the animation
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

/**
 * Dashboard Animation
 * Simulates leads moving through the qualification flow
 */
function initDashboardAnimation() {
    // Sample lead data
    const sampleLeads = [
        { name: 'Александр П.', message: 'Интересует подключение к сервису, есть вопросы по тарифам', source: 'Website', sourceClass: 'source-website' },
        { name: 'Елена К.', message: 'Хочу узнать подробнее о возможностях интеграции', source: 'Telegram', sourceClass: 'source-telegram' },
        { name: 'Сергей М.', message: 'Нужна консультация по корпоративному пакету', source: 'Website', sourceClass: 'source-website' },
        { name: 'Анна В.', message: 'Какие условия для новых клиентов?', source: 'Website', sourceClass: 'source-website' },
        { name: 'Дмитрий Л.', message: 'Хочу узнать сроки подключения', source: 'Telegram', sourceClass: 'source-telegram' },
        { name: 'Мария С.', message: 'Интересует API интеграция', source: 'Website', sourceClass: 'source-website' },
        { name: 'Игорь Т.', message: 'Есть ли скидки для постоянных клиентов?', source: 'Website', sourceClass: 'source-website' },
        { name: 'Ольга Н.', message: 'Нужна помощь с настройкой', source: 'Telegram', sourceClass: 'source-telegram' },
    ];

    const sampleQualified = [
        { name: 'Виктор Р.', score: 0.96, priority: 'Высокий', recommendation: 'Позвонить', action: 'Позвонить в течение 1 часа', badge: 'hot', label: 'ГОРЯЧИЙ', actionClass: 'call' },
        { name: 'Наталья Ф.', score: 0.78, priority: 'Средний', recommendation: 'Email', action: 'Связаться по email в течение 24 часов', badge: 'warm', label: 'ТЁПЛЫЙ', actionClass: 'follow-up' },
        { name: 'Артём Д.', score: 0.85, priority: 'Низкий', recommendation: 'Архивировать', action: 'Без срочных действий', badge: 'cold', label: 'ХОЛОДНЫЙ', actionClass: 'archive' },
    ];

    // Get containers
    const incomingContainer = document.getElementById('incoming-leads');
    const processingContainer = document.getElementById('processing-leads');
    const qualifiedContainer = document.getElementById('qualified-leads');

    if (!incomingContainer || !processingContainer || !qualifiedContainer) return;

    let leadIndex = 0;
    let qualifiedIndex = 0;

    // Create lead card HTML for incoming
    function createIncomingCard(lead) {
        const card = document.createElement('div');
        card.className = 'lead-card';
        card.innerHTML = `
            <div class="lead-header">
                <span class="lead-name">${lead.name}</span>
                <span class="lead-time">только что</span>
            </div>
            <div class="lead-message">${lead.message}</div>
            <div class="lead-source ${lead.sourceClass}">${lead.source}</div>
        `;
        card.style.opacity = '0';
        card.style.transform = 'translateY(-20px)';
        return card;
    }

    // Create processing card
    function createProcessingCard(lead) {
        const card = document.createElement('div');
        card.className = 'lead-card processing';
        card.innerHTML = `
            <div class="lead-header">
                <span class="lead-name">${lead.name}</span>
                <span class="lead-time">обработка</span>
            </div>
            <div class="lead-message">${lead.message}</div>
            <div class="lead-processing">
                <div class="processing-bar"></div>
            </div>
        `;
        card.style.opacity = '0';
        card.style.transform = 'translateX(-20px)';
        return card;
    }

    // Create qualified card
    function createQualifiedCard(lead) {
        const card = document.createElement('div');
        card.className = `lead-card qualified ${lead.badge}`;
        card.innerHTML = `
            <div class="lead-header">
                <span class="lead-name">${lead.name}</span>
                <span class="lead-badge ${lead.badge}">${lead.label}</span>
            </div>
            <div class="lead-score">
                <span class="score-label">Score:</span>
                <span class="score-value">${lead.score.toFixed(2)}</span>
            </div>
            <div class="lead-details">
                <div class="detail">
                    <span class="detail-label">Приоритет:</span>
                    <span class="detail-value">${lead.priority}</span>
                </div>
                <div class="detail">
                    <span class="detail-label">Рекомендация:</span>
                    <span class="detail-value">${lead.recommendation}</span>
                </div>
            </div>
            <div class="lead-action ${lead.actionClass}">
                <span>→ ${lead.action}</span>
                <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
        `;
        card.style.opacity = '0';
        card.style.transform = 'translateX(-20px)';
        return card;
    }

    // Animate card in
    function animateIn(element, transform = 'translateY(0)') {
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = transform;
        }, 50);
    }

    // Animate card out
    function animateOut(element, transform = 'translateY(20px)') {
        element.style.opacity = '0';
        element.style.transform = transform;
        setTimeout(() => element.remove(), 300);
    }

    // Add new incoming lead
    function addIncomingLead() {
        const lead = sampleLeads[leadIndex % sampleLeads.length];
        leadIndex++;

        const card = createIncomingCard(lead);

        // Limit to 3 visible cards
        while (incomingContainer.children.length >= 3) {
            incomingContainer.removeChild(incomingContainer.lastChild);
        }

        incomingContainer.insertBefore(card, incomingContainer.firstChild);
        animateIn(card, 'translateY(0)');

        // Move to processing after delay
        setTimeout(() => moveLeadToProcessing(card, lead), 2000);
    }

    // Move lead to processing
    function moveLeadToProcessing(incomingCard, lead) {
        animateOut(incomingCard, 'translateX(100%)');

        // Clear processing container
        processingContainer.innerHTML = '';

        const processingCard = createProcessingCard(lead);
        processingContainer.appendChild(processingCard);
        animateIn(processingCard, 'translateX(0)');

        // Move to qualified after processing
        setTimeout(() => {
            processingCard.style.opacity = '0';
            processingCard.style.transform = 'translateX(100%)';
            setTimeout(() => addQualifiedLead(lead), 300);
        }, 2500);
    }

    // Add qualified lead
    function addQualifiedLead(originalLead) {
        const qualified = sampleQualified[qualifiedIndex % sampleQualified.length];
        qualifiedIndex++;

        const card = createQualifiedCard(qualified);

        // Limit to 2 visible cards
        while (qualifiedContainer.children.length >= 2) {
            qualifiedContainer.removeChild(qualifiedContainer.lastChild);
        }

        qualifiedContainer.insertBefore(card, qualifiedContainer.firstChild);
        animateIn(card, 'translateX(0)');
    }

    // Start animation cycle
    // Initial leads
    setTimeout(() => {
        // Add initial qualified leads
        addQualifiedLead(sampleLeads[0]);
        setTimeout(() => addQualifiedLead(sampleLeads[1]), 500);
    }, 1000);

    // Add new incoming leads periodically
    setTimeout(() => addIncomingLead(), 2000);
    setInterval(addIncomingLead, 6000);
}

/**
 * Stat Counters Animation
 * Animates numbers when section comes into view
 */
function initStatCounters() {
    const stats = document.querySelectorAll('.stat-value');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateValue(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => {
        const text = stat.textContent;
        // Only animate numeric values
        if (/[0-9]/.test(text)) {
            stat.dataset.target = text;
            stat.textContent = '0';
            observer.observe(stat);
        }
    });
}

function animateValue(element) {
    const target = element.dataset.target;
    const isPercent = target.includes('%');
    const isTime = target.includes('с');
    const isTimeLess = target.includes('<');

    let numericPart = parseFloat(target.replace(/[^0-9.]/g, ''));
    let suffix = target.replace(/[0-9.<>%]/g, '').trim();
    if (isPercent) suffix = '%';
    if (isTime) suffix = 'с';
    if (isTimeLess) suffix = '<' + numericPart + suffix;

    const duration = 1500;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(numericPart * easeOutQuart * 10) / 10;

        if (isTimeLess) {
            element.textContent = '<' + current + suffix;
        } else if (isPercent) {
            element.textContent = current + suffix;
        } else {
            element.textContent = current + suffix;
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }

    requestAnimationFrame(update);
}

/**
 * Smooth Scroll
 * Enables smooth scrolling for anchor links
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const navHeight = document.querySelector('.nav').offsetHeight;
                const targetPosition = targetElement.offsetTop - navHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Navbar Background on Scroll
 */
window.addEventListener('scroll', () => {
    const nav = document.querySelector('.nav');
    if (window.scrollY > 50) {
        nav.style.background = 'rgba(10, 10, 15, 0.95)';
    } else {
        nav.style.background = 'rgba(10, 10, 15, 0.8)';
    }
});

/**
 * Dynamic Time Update in Dashboard
 */
function updateFlowTime() {
    const timeElement = document.querySelector('.flow-time');
    if (timeElement) {
        const now = new Date();
        const seconds = now.getSeconds();
        const timeText = seconds < 5 ? 'только что' :
                        seconds < 30 ? 'несколько секунд назад' :
                        'меньше минуты назад';
        timeElement.textContent = 'Обновлено ' + timeText;
    }
}

setInterval(updateFlowTime, 10000);

/**
 * Demo Access Popover
 * Handles popover toggle for demo access cards
 */
function initDemoPopover() {
    const demoTrigger = document.getElementById('demoTrigger');
    const demoDropdown = document.querySelector('.demo-dropdown');

    if (!demoTrigger || !demoDropdown) return;

    // Toggle popover on click
    demoTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        demoDropdown.classList.toggle('active');
    });

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        if (!demoDropdown.contains(e.target) && !demoTrigger.contains(e.target)) {
            demoDropdown.classList.remove('active');
        }
    });

    // Close popover on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            demoDropdown.classList.remove('active');
        }
    });

    // Handle demo card clicks - open in new tab without showing URL in status bar
    const demoCards = document.querySelectorAll('.demo-card');
    demoCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const url = card.dataset.href;
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
            demoDropdown.classList.remove('active');
        });

        // Handle keyboard navigation (Enter key)
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const url = card.dataset.href;
                if (url) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
                demoDropdown.classList.remove('active');
            }
        });
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initDemoPopover();
});