# 🤖 AI Промпты - Полная документация

## 📋 Содержание

1. [Промпт для анализа этикетки](#промпт-для-анализа-этикетки)
2. [Промпт для анализа INCI](#промпт-для-анализа-inci)
3. [Логика обработки](#логика-обработки)
4. [Рекомендации по улучшению](#рекомендации-по-улучшению)

---

## 1. Промпт для анализа этикетки

### 🎯 Цель промпта

Извлечь из этикетки косметического продукта:
1. **Назначение** - для чего предназначен продукт
2. **Применение** - как использовать продукт
3. **Дополнительную информацию** - производитель, объем, срок годности и т.д.

### 📝 Текущий промпт (версия 1.0)

**Файл:** `src/services/aiService.js:94-115`

```javascript
const prompt = `
  Analyze this cosmetic product label and extract information in JSON format:

  Product Name: ${data.productName}
  ${data.labelText ? `Label Text: ${data.labelText}` : 'Please read text from the image'}

  Output JSON structure:
  {
    "labelInfo": "Краткое описание информации с этикетки: производитель, объем, срок годности, сертификация, основные ингредиенты, предупреждения и т.д. (на русском, 2-3 предложения)",
    "suggestedPurpose": "Предполагаемое назначение продукта на основе информации с этикетки (краткое, 1-2 предложения на русском)",
    "suggestedApplication": "Предполагаемый способ применения продукта на основе инструкций с этикетки (краткое, 1-2 предложения на русском)"
  }

  Important:
  - Extract manufacturer, volume, expiry date if visible
  - Identify key active ingredients mentioned on front label
  - Note any certifications (organic, vegan, cruelty-free, etc.)
  - Read usage instructions if present
  - Base suggestions ONLY on information from the label
  - Be concise but informative
  - Write in Russian
`;
```

### 🔍 Разбор промпта по частям

#### **Блок 1: Входные данные**

```javascript
Product Name: ${data.productName}
${data.labelText ? `Label Text: ${data.labelText}` : 'Please read text from the image'}
```

**Логика:**
- `data.productName` - название продукта, введенное пользователем (например: "Крем для лица")
- `data.labelText` - текст, извлеченный из PDF с помощью pdf-parse (если этикетка - PDF файл)
- Если текст извлечен → передаем его AI для анализа
- Если текст НЕ извлечен (изображение) → AI читает текст с изображения напрямую

**Зачем это нужно:**
- PDF содержит текстовый слой → точнее извлечь информацию
- Изображение → AI использует vision модель для распознавания текста

#### **Блок 2: Структура ответа**

```json
{
  "labelInfo": "Краткое описание...",
  "suggestedPurpose": "Назначение...",
  "suggestedApplication": "Применение..."
}
```

**Что получаем:**

1. **labelInfo** - общая информация с этикетки:
   - Производитель
   - Объем (мл, г)
   - Срок годности
   - Сертификации (organic, vegan, etc.)
   - Основные ингредиенты
   - Предупреждения

2. **suggestedPurpose** - **НАЗНАЧЕНИЕ** продукта:
   - Для чего предназначен
   - Какой тип кожи
   - Какую проблему решает
   - Пример: "Интенсивное увлажнение и питание сухой кожи лица"

3. **suggestedApplication** - **ПРИМЕНЕНИЕ** продукта:
   - Как использовать
   - Когда использовать (утро/вечер)
   - Сколько наносить
   - Пример: "Наносить на чистую кожу лица утром и вечером легкими массажными движениями"

#### **Блок 3: Инструкции**

```
Important:
- Extract manufacturer, volume, expiry date if visible
- Identify key active ingredients mentioned on front label
- Note any certifications (organic, vegan, cruelty-free, etc.)
- Read usage instructions if present
- Base suggestions ONLY on information from the label
- Be concise but informative
- Write in Russian
```

**Логика инструкций:**

1. **"Extract manufacturer, volume, expiry date"**
   - Ищем производителя (например: "ООО Косметика", "Made in France")
   - Объем (50ml, 100г)
   - Срок годности (24 месяца)

2. **"Identify key active ingredients"**
   - Ключевые активные ингредиенты, указанные на ПЕРЕДНЕЙ стороне этикетки
   - Например: "с гиалуроновой кислотой", "with retinol"

3. **"Note any certifications"**
   - Сертификаты: organic, vegan, cruelty-free, ecocert и т.д.
   - Важно для маркетинга

4. **"Base suggestions ONLY on information from the label"**
   - ⚠️ **КРИТИЧНО:** AI НЕ должен додумывать!
   - Только то, что **явно написано** на этикетке

5. **"Be concise but informative"**
   - Не писать эссе, но и не упускать важные детали

6. **"Write in Russian"**
   - Все ответы на русском языке

---

## ⚠️ ПРОБЛЕМА текущего промпта

### Что НЕ ТАК:

**Текущая инструкция:**
> "Предполагаемое назначение продукта на основе информации с этикетки (**краткое, 1-2 предложения** на русском)"

**Проблема:**
- ❌ AI **перефразирует** текст с этикетки
- ❌ AI **сокращает** информацию до 1-2 предложений
- ❌ AI **опускает детали** для краткости

**Что мы ХОТИМ:**
- ✅ Извлекать текст **МАКСИМАЛЬНО БЛИЗКО** к оригиналу
- ✅ **НЕ ПЕРЕФРАЗИРОВАТЬ**
- ✅ **НЕ ОПУСКАТЬ** важные моменты
- ✅ Если на этикетке написано 5 предложений → извлечь все 5

---

## ✅ УЛУЧШЕННЫЙ промпт (версия 2.0)

**Обновленная версия:**

```javascript
const prompt = `
  You are a professional cosmetic product data extractor. Your task is to read the cosmetic product label and extract information EXACTLY as written, without paraphrasing or shortening.

  Product Name: ${data.productName}
  ${data.labelText ? `Label Text (extracted from PDF):\n${data.labelText}` : 'Please carefully read ALL text from the label image'}

  CRITICAL INSTRUCTIONS:
  1. Extract text VERBATIM (word-for-word) from the label
  2. DO NOT paraphrase or rewrite the text
  3. DO NOT shorten or summarize - include ALL relevant information
  4. DO NOT add information not present on the label
  5. If text is in Russian - keep it in Russian
  6. If text is in English - keep it in English

  Output JSON structure:
  {
    "labelInfo": "Manufacturer, volume, expiry date, certifications, warnings (2-3 sentences, Russian)",
    "suggestedPurpose": "EXACT text from label about product purpose/benefits - word-for-word copy from 'Назначение' or 'Для чего' section. Include ALL details mentioned. If not found, analyze ingredients and product type to suggest purpose.",
    "suggestedApplication": "EXACT text from label about usage instructions - word-for-word copy from 'Способ применения' or 'Application' section. Include ALL steps, frequency, and precautions mentioned. If not found, suggest based on product type."
  }

  EXAMPLES:

  ❌ BAD (paraphrased):
  "suggestedPurpose": "Увлажняет кожу"

  ✅ GOOD (verbatim from label):
  "suggestedPurpose": "Предназначен для интенсивного увлажнения и питания сухой и обезвоженной кожи лица. Восстанавливает защитный барьер кожи, устраняет шелушение, придает коже мягкость и эластичность. Подходит для ежедневного использования."

  ❌ BAD (shortened):
  "suggestedApplication": "Наносить утром и вечером"

  ✅ GOOD (complete instructions):
  "suggestedApplication": "Наносить на предварительно очищенную кожу лица утром и вечером легкими массажными движениями до полного впитывания. Избегать области вокруг глаз. Рекомендуется использовать в сочетании с солнцезащитным кремом в дневное время."

  Remember: Your goal is to PRESERVE the original text, not to improve or shorten it.
  Ваша цель - СОХРАНИТЬ оригинальный текст, а не улучшить или сократить его.
`;
```

### 🔑 Ключевые улучшения

1. **"Extract text VERBATIM (word-for-word)"**
   - Извлекать текст **дословно**

2. **"DO NOT paraphrase or rewrite"**
   - НЕ перефразировать

3. **"DO NOT shorten or summarize - include ALL relevant information"**
   - НЕ сокращать - включить ВСЮ информацию

4. **"EXACT text from label about..."**
   - **ТОЧНЫЙ** текст с этикетки

5. **Примеры BAD vs GOOD**
   - Показываем AI, что мы хотим и чего НЕ хотим

---

## 2. Промпт для анализа INCI

**Файл:** `src/services/aiService.js:159-193`

### 🎯 Цель

Извлечь из INCI документа:
1. Полный состав на русском (с % и без %)
2. Полный состав на английском (с % и без %)
3. Список активных ингредиентов (RU и EN)
4. Маркетинговое описание состава для буклета (RU и EN)

### 📝 Текущий промпт

```javascript
const prompt = `
  Analyze this cosmetic product INCI composition and extract comprehensive information in JSON format:

  Product Name: ${data.productName}
  Purpose: ${data.purpose}
  INCI: ${data.inci || 'Please try to read from image'}

  Output JSON structure:
  {
    "fullCompositionRuWithPercent": "Полный состав на русском языке С ПРОЦЕНТАМИ (если указаны в INCI). Если процентов нет, оставить пустым.",
    "fullCompositionRuNoPercent": "Полный состав на русском языке БЕЗ ПРОЦЕНТОВ, от большего к меньшему",
    "fullCompositionEnWithPercent": "Full composition in English WITH PERCENTAGES (if provided in INCI). Leave empty if no percentages.",
    "fullCompositionEnNoPercent": "Full composition in English WITHOUT PERCENTAGES, from highest to lowest",
    "activeIngredients": ["Список АКТИВНЫХ ингредиентов на русском БЕЗ % (только те, что имеют косметический эффект)"],
    "activeIngredientsEn": ["List of ACTIVE ingredients in English WITHOUT % (only those with cosmetic effect)"],
    "bookletComposition": "Краткое маркетинговое описание состава для буклета (2-3 предложения, русский, подчеркивает пользу)",
    "bookletCompositionEn": "Short marketing composition description for booklet (2-3 sentences, English, highlights benefits)"
  }

  CRITICAL RULES:
  1. If INCI contains percentages (e.g., "Water 70%, Glycerin 20%"), extract them for "WithPercent" fields
  2. If NO percentages in INCI, leave "WithPercent" fields EMPTY (do not invent percentages)
  3. "NoPercent" fields must list ingredients in descending order without any percentages
  4. ACTIVE ingredients are those with cosmetic/therapeutic effects (not preservatives, water, emulsifiers)
  5. Translate ingredient names accurately between Russian and English
  6. For booklet descriptions, focus on key benefits and marketing appeal
  7. Maintain professional cosmetic industry terminology
  8. Do NOT include percentages in activeIngredients arrays

  Example active ingredients:
  - Hyaluronic Acid, Retinol, Vitamin C, Niacinamide, Peptides, Plant Extracts
  - NOT: Water, Glycerin (unless >10%), Preservatives, Emulsifiers

  If you cannot read INCI from text or image, return error message in each field.
`;
```

---

## 3. Логика обработки

### Шаг 1: Пользователь загружает файл этикетки

**Frontend → Backend:**
- FormData с полями: `labelFile`, `cardFolderId`, `productName`

### Шаг 2: Backend извлекает текст (если PDF)

**Код:** `src/routes/cards.js:152-159`

```javascript
let labelText = '';
try {
  if (req.file.mimetype === 'application/pdf') {
    const pdfData = await pdfParse(req.file.buffer);
    labelText = pdfData.text.trim();
    console.log(`📝 Extracted ${labelText.length} characters from PDF`);
  }
} catch (error) {
  console.error('⚠️ PDF parsing error:', error.message);
}
```

### Шаг 3: AI обработка

**Код:** `src/routes/cards.js:162-167`

```javascript
console.log(`🤖 Processing label with AI...`);
const aiResult = await aiService.analyzeLabelOnly(
  { productName, labelText },  // Данные
  req.file.buffer,             // Изображение
  req.file.mimetype            // Тип файла
);
```

**AI получает:**
- `productName` - название продукта
- `labelText` - извлеченный текст (если PDF)
- `imageBuffer` - бинарные данные файла (для vision модели)
- `mimeType` - тип файла

**AI возвращает:**
```json
{
  "labelInfo": "Производитель: ООО Космо, Объем: 50мл, ...",
  "suggestedPurpose": "Интенсивное увлажнение сухой кожи...",
  "suggestedApplication": "Наносить на чистую кожу утром и вечером..."
}
```

### Шаг 4: Сохранение в Google Sheets

**Текущий код:** `src/routes/cards.js:170-177`

```javascript
const cardRow = await sheetsService.getRowByCardId(cardId);
if (cardRow) {
  await sheetsService.updateLabelInfo(
    cardRow.rowNumber,
    labelLink,                  // Столбец E: Ссылка на этикетку
    aiResult.labelInfo || ''    // Столбец F: Информация с этикетки
  );
}
```

**⚠️ ПРОБЛЕМА:** Столбцы "Назначение" (B) и "Применение" (C) **НЕ ОБНОВЛЯЮТСЯ**!

---

## 4. Рекомендации по улучшению

### ✅ Что нужно исправить:

1. **Обновить промпт** - убрать "краткое, 1-2 предложения"
2. **Сохранять Назначение и Применение в Sheets** - столбцы B и C
3. **UI: показывать превью файла** вместо текстовой ссылки
4. **Добавить валидацию** - проверять, что AI вернул не пустые значения

### 📋 План реализации:

1. ✅ Обновить `aiService.js` - новый промпт
2. ✅ Обновить `sheetsService.js` - добавить методы обновления столбцов B и C
3. ✅ Обновить `cards.js` - сохранять Назначение и Применение
4. ✅ Обновить `app.js` - показывать превью файла

---

**Дата создания:** 2025-11-27
**Версия:** 2.0
**Статус:** Требует обновления кода
