# Маршрут проверки демо — Lead Qualification MVP

Как быстро убедиться, что квалификация лидов работает: оставить заявку
на демо-лендинге и проследить путь до карточки в админ-консоли, либо
пройти Telegram-диалог с ботом.

## Маршрут проверки

1. **Открыть** [Demo Landing](https://lead-qual-demo.alex-n8n.site) →
   **нажать** «Получить демо» → **заполнить** веб-форму → **увидеть**
   номер заявки в формате LQ-XXXXXX.
2. **Пройти** [бота в Telegram](https://t.me/OptimusLeadQualificationBot) →
   **получить** пошаговый диалог: имя → телефон → e-mail → описание
   задачи → подтверждение → **увидеть** сообщение «Заявка
   зарегистрирована».
3. **Открыть** [админ-консоль](https://lead-qual-admin.alex-n8n.site/) →
   **найти** свою заявку в списке → **проверить** карточку: тип заявки
   и приоритет (hot / warm / cold / spam), confidence, источник
   (Web или Telegram).
4. **Сравнить** два обращения с разными формулировками (например,
   срочная задача и общий вопрос) → **увидеть** разные тип, приоритет
   и confidence: квалификация действительно различает обращения.

## Что ещё доступно

- Workflow-логика в n8n: три процесса — приём заявки, квалификация
  и уведомление менеджера (см.
  [ARCHITECTURE.md](https://github.com/AlexLvGulyaev/Lead-Qualification-MVP/blob/main/docs/ARCHITECTURE.md)).
- Как читать карточки и приоритеты:
  [MANAGER_GUIDE.md](https://github.com/AlexLvGulyaev/Lead-Qualification-MVP/blob/main/docs/MANAGER_GUIDE.md).
- Полный скриншот-тур:
  [SYSTEM_DEMO.md](https://github.com/AlexLvGulyaev/Lead-Qualification-MVP/blob/main/docs/SYSTEM_DEMO.md).
