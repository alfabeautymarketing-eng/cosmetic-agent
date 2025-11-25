# Как получить credentials.json для локальной разработки

## Вариант 1: Скопировать из Render (БЫСТРО)

1. Открой настройки на Render:
   https://dashboard.render.com/web/[твой-сервис]/env

2. Найди переменную `GOOGLE_SERVICE_ACCOUNT_JSON`

3. Скопируй **весь** JSON (он должен начинаться с `{` и заканчиваться `}`)

4. Создай файл `credentials.json` в корне проекта:
   ```bash
   nano /Users/aleksandr/Desktop/cosmetic-agent/credentials.json
   ```

5. Вставь JSON и сохрани (Ctrl+O, Enter, Ctrl+X)

## Вариант 2: Скачать из Google Cloud Console

1. Открой Google Cloud Console:
   https://console.cloud.google.com/

2. Выбери свой проект

3. IAM & Admin → Service Accounts

4. Найди свой Service Account

5. Actions → Manage keys → Add key → Create new key → JSON

6. Сохрани файл как `credentials.json` в корне проекта

## Проверка

После создания файла проверь:

```bash
ls -la /Users/aleksandr/Desktop/cosmetic-agent/credentials.json
```

Должен появиться файл. Затем перезапусти сервер.
