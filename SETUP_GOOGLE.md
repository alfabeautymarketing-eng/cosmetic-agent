# Настройка Google Service Account

Для работы агента нужно получить учетные данные Google Service Account с доступом к Google Drive и Google Sheets API.

## Шаг 1: Создание Google Cloud проекта

1. Перейди в [Google Cloud Console](https://console.cloud.google.com/)
2. Создай новый проект или выбери существующий
3. Запомни название проекта

## Шаг 2: Включение API

1. В Google Cloud Console, перейди в **APIs & Services** → **Library**
2. Найди и включи следующие API:
   - **Google Drive API**
   - **Google Sheets API**

Для каждого API:
- Нажми на название
- Нажми **Enable** (Включить)

## Шаг 3: Создание Service Account

1. Перейди в **APIs & Services** → **Credentials**
2. Нажми **+ CREATE CREDENTIALS** → **Service account**
3. Заполни данные:
   - **Service account name**: `cosmetic-agent`
   - **Service account ID**: автоматически сгенерируется
   - **Description**: "Agent for processing cosmetic product cards"
4. Нажми **CREATE AND CONTINUE**
5. В разделе **Grant this service account access to project**:
   - Role: выбери **Editor** (или можно оставить без роли)
6. Нажми **CONTINUE** → **DONE**

## Шаг 4: Создание JSON ключа

1. На странице **Credentials**, найди созданный Service Account
2. Кликни на email Service Account (например, `cosmetic-agent@your-project.iam.gserviceaccount.com`)
3. Перейди на вкладку **KEYS**
4. Нажми **ADD KEY** → **Create new key**
5. Выбери формат **JSON**
6. Нажми **CREATE**
7. Файл автоматически скачается на твой компьютер

## Шаг 5: Настройка доступа к Google Drive и Sheets

### Google Drive:

1. Открой скачанный JSON файл
2. Найди поле `client_email` (например: `cosmetic-agent@your-project.iam.gserviceaccount.com`)
3. Скопируй этот email
4. **Обязательно используй Shared Drive!** Service Account не имеет своей квоты и не сможет загружать файлы в "Мой диск". Создай Shared Drive, помести туда корневую папку для карточек и выдай Service Account права.
5. Перейди в корневую папку в Shared Drive: https://drive.google.com/drive/folders/1rELo6cM69I8_105PY-XKuJv1W33VDH1R (замени на свою)
6. Нажми правой кнопкой → **Share** (Поделиться)
7. Вставь скопированный email
8. Дай права **Editor** или **Content manager**
9. Нажми **Share** (убери галочку "Notify people" если не хочешь слать уведомление)
10. Скопируй ID Shared Drive из URL и добавь его в `.env` как `GOOGLE_DRIVE_SHARED_DRIVE_ID`

### Google Sheets:

1. Открой твою Google таблицу
2. Нажми **Share** (Поделиться)
3. Вставь тот же email Service Account
4. Дай права **Editor** (Редактор)
5. Нажми **Share**

## Шаг 6: Настройка проекта

1. Переименуй скачанный JSON файл в `credentials.json`
2. Помести его в корень проекта `/Users/aleksandr/Desktop/MyGoogleScripts/cosmetic-agent/credentials.json`
3. Убедись, что файл добавлен в `.gitignore` (уже добавлен)

## Шаг 7: Обновление .env файла

Открой файл `.env` и обнови следующие переменные:

```env
# ID твоей Google таблицы (из URL)
# https://docs.google.com/spreadsheets/d/[ВОТ_ЭТОТ_ID]/edit
GOOGLE_SHEET_ID=твой_sheet_id_здесь
```

## Проверка

После всех настроек структура должна быть такой:

```
cosmetic-agent/
├── credentials.json          ← JSON ключ Service Account
├── .env                      ← Настройки окружения
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── SETUP_GOOGLE.md
└── src/
    ├── config/
    │   └── googleAuth.js
    ├── routes/
    │   ├── health.js
    │   └── webhook.js
    ├── services/
    │   ├── cardProcessor.js
    │   ├── driveService.js
    │   └── sheetsService.js
    └── utils/
        └── fileDownloader.js
```

## Тестирование

Запусти сервер:

```bash
npm run dev
```

Если все настроено правильно, ты увидишь:

```
✅ Google API авторизация успешна
🚀 Cosmetic Agent running on port 3000
📁 Google Drive Folder: 1rELo6cM69I8_105PY-XKuJv1W33VDH1R
📊 Google Sheet ID: твой_sheet_id
🌍 Environment: development
```

## Возможные ошибки

### "Error: ENOENT: no such file or directory"
- Проверь, что файл `credentials.json` находится в корне проекта
- Проверь путь в `.env`: `GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials.json`

### "Error 403: Forbidden"
- Убедись, что ты дал Service Account права доступа к папке Drive и таблице Sheets
- Проверь, что API включены в Google Cloud Console

### "Error: Cannot find module 'googleapis'"
- Выполни `npm install` еще раз
