# AI Processing Module

Этот модуль предназначен для будущей интеграции с AI для обработки данных карточек.

## Структура

```
src/ai/
├── README.md              ← Этот файл
├── prompts.js             ← Системные промпты для различных задач
└── aiService.js           ← Будущий сервис для вызова AI API (Claude, OpenAI, etc.)
```

## Текущий статус

На данный момент модуль содержит:

1. **prompts.js** - Готовые промпты для AI-обработки:
   - Извлечение активных ингредиентов (RU/EN)
   - Генерация состава для буклета (RU/EN)
   - Полный состав с переводом (RU/EN)

## Следующие шаги (TODO)

### 1. Выбор AI провайдера

Нужно решить, какой AI использовать:

- **Anthropic Claude** (рекомендуется для русского языка)
  - Лучшее понимание контекста
  - Хорошая работа с инструкциями
  - API: https://www.anthropic.com/api

- **OpenAI GPT-4**
  - Популярный вариант
  - Много документации
  - API: https://platform.openai.com/

- **Google Gemini**
  - Бесплатный тариф
  - Интеграция с Google Workspace
  - API: https://ai.google.dev/

### 2. Создание aiService.js

Пример структуры:

```javascript
// src/ai/aiService.js
const { prompts } = require('./prompts');

class AIService {
  constructor() {
    this.apiKey = process.env.AI_API_KEY;
    this.provider = process.env.AI_PROVIDER; // 'claude' | 'openai' | 'gemini'
  }

  async processPrompt(promptName, ...args) {
    const prompt = prompts[promptName];
    if (!prompt) {
      throw new Error(`Prompt ${promptName} not found`);
    }

    const userMessage = prompt.userPromptTemplate(...args);

    // Вызов AI API
    const response = await this.callAI(
      prompt.systemPrompt,
      userMessage
    );

    return response;
  }

  async callAI(systemPrompt, userMessage) {
    // TODO: Реализовать вызов API
    // В зависимости от this.provider
  }
}

module.exports = new AIService();
```

### 3. Интеграция с основным процессором

После создания AI сервиса, обновить `cardProcessor.js`:

```javascript
// src/services/cardProcessor.js
const aiService = require('../ai/aiService');

async processCard(data) {
  // ... существующий код ...

  // Если есть INCI, обрабатываем через AI
  if (data.inci) {
    // Извлекаем активные ингредиенты
    const activeIngredientsRU = await aiService.processPrompt(
      'extractActiveIngredientsRU',
      data.inci
    );

    const activeIngredientsEN = await aiService.processPrompt(
      'extractActiveIngredientsEN',
      data.inci
    );

    // Обновляем таблицу с результатами AI
    await sheetsService.updateCell(sheetRow, 'I', activeIngredientsRU); // Столбец I
    await sheetsService.updateCell(sheetRow, 'J', activeIngredientsEN); // Столбец J
  }

  // ... остальной код ...
}
```

### 4. Добавление переменных окружения

В `.env`:

```env
# AI Configuration
AI_PROVIDER=claude          # claude | openai | gemini
AI_API_KEY=your_api_key_here
AI_MODEL=claude-3-sonnet-20240229  # или gpt-4, gemini-pro
```

## Расширение системы промптов

Чтобы добавить новый промпт:

1. Открой `prompts.js`
2. Добавь новый объект в `prompts`:

```javascript
myNewPrompt: {
  name: 'Описание промпта',
  systemPrompt: `System instructions here...`,
  userPromptTemplate: (param1, param2) => `User message with ${param1} and ${param2}`
}
```

3. Используй в коде:

```javascript
const result = await aiService.processPrompt('myNewPrompt', value1, value2);
```

## Преимущества текущей архитектуры

1. **Масштабируемость**: Легко добавлять новые промпты
2. **Централизация**: Все промпты в одном месте
3. **Версионирование**: Промпты хранятся в Git
4. **Тестирование**: Можно тестировать промпты независимо
5. **Гибкость**: Легко менять AI провайдера

## Стоимость AI обработки (примерная)

### Claude 3 Sonnet:
- Input: $3 / 1M токенов
- Output: $15 / 1M токенов
- ~1000 токенов на карточку = $0.018 за карточку

### GPT-4:
- Input: $10 / 1M токенов
- Output: $30 / 1M токенов
- ~1000 токенов на карточку = $0.04 за карточку

### Gemini Pro:
- Бесплатно до 60 запросов/минуту
- После лимита: $0.00025 / 1K токенов

## Оптимизация затрат

1. Использовать кеширование результатов
2. Батчинг запросов
3. Выбор оптимальной модели (не всегда нужна самая мощная)
4. Использовать бесплатные тарифы где возможно
