#!/bin/bash
# Test payloads for Lead Ingestion Webhook
# Usage: ./test-commands.sh [test_name]
#
# Prerequisites:
# 1. n8n workflow imported and activated
# 2. Webhook URL is http://localhost:5678/webhook/lead

WEBHOOK_URL="http://localhost:5678/webhook/lead"

# Test 1: Hot Lead - Valid (expected: 200)
test_hot_lead() {
    echo "=== Test: Hot Lead (Valid) ==="
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Иван Петров",
            "phone": "+79991234567",
            "email": "ivan@example.com",
            "message": "Хочу купить вашу услугу прямо сейчас, готов оплатить сегодня. Перезвоните мне срочно!",
            "source": "website_contact_form",
            "utm_source": "google",
            "utm_campaign": "brand_awareness"
        }'
    echo ""
}

# Test 2: Warm Lead - Valid (expected: 200)
test_warm_lead() {
    echo "=== Test: Warm Lead (Valid) ==="
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Мария Сидорова",
            "phone": "+79992222222",
            "message": "Интересует ваш продукт, расскажите подробнее о возможностях и ценах.",
            "source": "landing_page",
            "utm_source": "yandex",
            "utm_campaign": "search_ads"
        }'
    echo ""
}

# Test 3: Cold Lead - Valid (expected: 200)
test_cold_lead() {
    echo "=== Test: Cold Lead (Valid) ==="
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Алексей Козлов",
            "email": "alexey@example.com",
            "message": "Может быть позже вернусь к вам, пока думаю над предложением.",
            "source": "organic_search",
            "utm_source": "google"
        }'
    echo ""
}

# Test 4: Spam Lead - Valid (expected: 200)
test_spam_lead() {
    echo "=== Test: Spam Lead (Valid) ==="
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Спамер",
            "phone": "+79994444444",
            "message": "Предлагаю купить базу контактов для вашего бизнеса. Отличные цены!",
            "source": "unknown"
        }'
    echo ""
}

# Test 5: Invalid - Missing Message (expected: 400)
test_invalid_short_message() {
    echo "=== Test: Invalid - Short Message ==="
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Короткое сообщение",
            "phone": "+79995555555",
            "message": "Привет",
            "source": "website"
        }'
    echo ""
}

# Test 6: Invalid - No Contact Info (expected: 400)
test_invalid_no_contact() {
    echo "=== Test: Invalid - No Contact Info ==="
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Без контактов",
            "message": "Хочу узнать больше информации о ваших услугах и возможностях.",
            "source": "website"
        }'
    echo ""
}

# Test 7: Invalid - Missing Source (expected: 400)
test_invalid_no_source() {
    echo "=== Test: Invalid - Missing Source ==="
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Без источника",
            "phone": "+79996666666",
            "message": "Хочу узнать больше информации о ваших услугах и возможностях."
        }'
    echo ""
}

# Test 8: Minimal Valid (expected: 200)
test_minimal_valid() {
    echo "=== Test: Minimal Valid Lead ==="
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{
            "phone": "+79997777777",
            "message": "Прошу перезвонить мне по вопросу консультации по вашим услугам.",
            "source": "callback_request"
        }'
    echo ""
}

# Run all tests
run_all_tests() {
    echo "Running all tests..."
    echo "========================"
    echo ""
    test_hot_lead
    test_warm_lead
    test_cold_lead
    test_spam_lead
    echo ""
    echo "=== INVALID TESTS (should return 400) ==="
    echo ""
    test_invalid_short_message
    test_invalid_no_contact
    test_invalid_no_source
    echo ""
    test_minimal_valid
}

# Main
case "$1" in
    hot) test_hot_lead ;;
    warm) test_warm_lead ;;
    cold) test_cold_lead ;;
    spam) test_spam_lead ;;
    invalid_short) test_invalid_short_message ;;
    invalid_contact) test_invalid_no_contact ;;
    invalid_source) test_invalid_no_source ;;
    minimal) test_minimal_valid ;;
    all) run_all_tests ;;
    *)
        echo "Usage: $0 [test_name|all]"
        echo ""
        echo "Available tests:"
        echo "  hot            - Hot lead (valid)"
        echo "  warm           - Warm lead (valid)"
        echo "  cold           - Cold lead (valid)"
        echo "  spam           - Spam lead (valid)"
        echo "  invalid_short  - Invalid: short message"
        echo "  invalid_contact- Invalid: no contact info"
        echo "  invalid_source - Invalid: missing source"
        echo "  minimal        - Minimal valid lead"
        echo "  all            - Run all tests"
        ;;
esac