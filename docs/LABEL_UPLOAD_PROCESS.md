# 📋 Процесс загрузки этикетки и AI обработки

## 🔄 Пошаговый процесс

### Шаг 1: Пользователь загружает файл
**Frontend:** [public/app.js:274-343](../public/app.js#L274-L343)
```javascript
async function handleLabelFile() {
    const fileInput = document.getElementById('labelFile');
    const file = fileInput.files[0];  // Получаем файл от пользователя

    // ... показываем превью ...

    // Автоматически отправляем на сервер
    await uploadLabelFile(file);
}
```

### Шаг 2: Frontend отправляет файл на сервер
**Frontend:** [public/app.js:296-307](../public/app.js#L296-L307)
```javascript
const formData = new FormData();
formData.append('labelFile', file);                      // Файл этикетки
formData.append('cardFolderId', currentCard.cardFolderId); // ID папки карточки
formData.append('productName', currentCard.productName);   // Название продукта

const response = await fetch(`/api/cards/${currentCard.cardId}/label`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getAuthToken()}` },
    body: formData
});
```

### Шаг 3: Backend принимает файл
**Backend:** [src/routes/cards.js:120-143](../src/routes/cards.js#L120-L143)
```javascript
router.post('/:cardId/label', authMiddleware, upload.single('labelFile'), async (req, res) => {
    const { cardId } = req.params;
    const { cardFolderId, productName } = req.body;

    // Проверяем наличие файла
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'Файл этикетки не загружен' });
    }

    // req.file содержит:
    // - originalname: "этикетка.pdf"
    // - buffer: содержимое файла
    // - mimetype: "application/pdf"
```

### Шаг 4: Загрузка файла в Google Drive
**Backend:** [src/routes/cards.js:135-146](../src/routes/cards.js#L135-L146)
```javascript
// Генерируем имя файла
const fileExtension = req.file.originalname.split('.').pop();
const labelFileName = `Этикетка ${productName}.${fileExtension}`;

// Загружаем в Drive (ЗДЕСЬ ПРОИСХОДИТ ОШИБКА, если нет доступа!)
const labelFileId = await driveService.uploadFile(
    labelFileName,           // "Этикетка Крем для лица.pdf"
    req.file.buffer,         // Содержимое файла
    req.file.mimetype,       // "application/pdf"
    cardFolderId             // ID папки карточки
);

const labelLink = driveService.getFileUrl(labelFileId);
```

**⚠️ КРИТИЧНО:** На этом шаге происходит ошибка `Service Accounts do not have storage quota`, если Service Account НЕ ИМЕЕТ доступа к папке!

### Шаг 5: Извлечение текста из PDF (если это PDF)
**Backend:** [src/routes/cards.js:149-159](../src/routes/cards.js#L149-L159)
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

### Шаг 6: AI обработка с Gemini
**Backend:** [src/routes/cards.js:162-167](../src/routes/cards.js#L162-L167)
```javascript
console.log(`🤖 Processing label with AI...`);
const aiResult = await aiService.analyzeLabelOnly(
    { productName, labelText },  // Данные для анализа
    req.file.buffer,             // Буфер изображения (для vision)
    req.file.mimetype            // Тип файла
);
```

**AI Service:** [src/services/aiService.js:83-142](../src/services/aiService.js#L83-L142)
```javascript
async analyzeLabelOnly(data, imageBuffer, mimeType) {
    if (!this.genAI) {
        return {
            labelInfo: 'AI не настроен (отсутствует GEMINI_API_KEY)',
            suggestedPurpose: '',
            suggestedApplication: ''
        };
    }

    // Формируем prompt для Gemini
    const prompt = `
        Analyze this cosmetic product label and extract information in JSON format:

        Product Name: ${data.productName}
        ${data.labelText ? `Label Text: ${data.labelText}` : 'Please read text from the image'}

        Output JSON structure:
        {
          "labelInfo": "Краткое описание информации с этикетки...",
          "suggestedPurpose": "Предполагаемое назначение продукта...",
          "suggestedApplication": "Предполагаемый способ применения..."
        }
    `;

    // Отправляем в Gemini с изображением
    if (imageBuffer) {
        const imagePart = {
            inlineData: {
                data: imageBuffer.toString('base64'),
                mimeType: mimeType,
            },
        };
        result = await this.model.generateContent([prompt, imagePart]);
    }

    // Парсим JSON ответ
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
}
```

### Шаг 7: Обновление Google Sheets
**Backend:** [src/routes/cards.js:170-177](../src/routes/cards.js#L170-L177)
```javascript
const cardRow = await sheetsService.getRowByCardId(cardId);
if (cardRow) {
    await sheetsService.updateLabelInfo(
        cardRow.rowNumber,
        labelLink,                  // Ссылка на файл в Drive
        aiResult.labelInfo || ''    // Информация из AI
    );
}
```

### Шаг 8: Возврат результата на Frontend
**Backend:** [src/routes/cards.js:181-192](../src/routes/cards.js#L181-L192)
```javascript
res.json({
    success: true,
    labelLink,
    labelFileName,
    aiSuggestions: {
        purpose: aiResult.suggestedPurpose || '',      // AI предложение для "Назначение"
        application: aiResult.suggestedApplication || '' // AI предложение для "Применение"
    },
    labelInfo: aiResult.labelInfo || '',
    message: 'Этикетка загружена и обработана AI'
});
```

### Шаг 9: Frontend автозаполняет поля
**Frontend:** [public/app.js:318-337](../public/app.js#L318-L337)
```javascript
// Автозаполняем поля Назначение и Применение из AI
if (data.aiSuggestions.purpose) {
    document.getElementById('purpose').value = data.aiSuggestions.purpose;
}
if (data.aiSuggestions.application) {
    document.getElementById('application').value = data.aiSuggestions.application;
}

// Показываем результаты AI
const resultContent = document.getElementById('labelResultsContent');
resultContent.innerHTML = `
    <p><strong>📎 Файл:</strong> ${data.labelFileName}</p>
    <p><strong>🔗 Ссылка:</strong> <a href="${data.labelLink}" target="_blank">Открыть в Drive</a></p>
    ${data.labelInfo ? `<p><strong>ℹ️ Информация:</strong> ${data.labelInfo}</p>` : ''}
    <p style="color: #28a745; margin-top: 10px;">✅ Поля "Назначение" и "Применение" автоматически заполнены</p>
`;

// Проверяем заполненность полей (показываем кнопку "Загрузить INCI")
checkInfoFields();
```

---

## 🐛 Текущая проблема

### Проблема 1: Google Drive Storage Quota
**Ошибка:** `Service Accounts do not have storage quota`
**Где:** Шаг 4 - загрузка файла в Google Drive
**Причина:** Service Account не имеет доступа к папке
**Решение:** Дать доступ Service Account к папке (см. инструкцию ниже)

### Проблема 2: AI не заполняет поля
**Симптом:** Поля "Назначение" и "Применение" остаются пустыми
**Возможные причины:**
1. **Gemini API не работает** (ключ не установлен или неверный)
2. **Google Drive падает** (из-за ошибки Storage Quota) - весь процесс прерывается
3. **AI возвращает пустые значения** (неправильный prompt или ошибка парсинга JSON)

**Как проверить:**
1. Откройте консоль браузера (F12 → Console)
2. Загрузите этикетку
3. Посмотрите логи сервера в терминале

---

## ✅ Решение проблемы Google Drive

### ОБЯЗАТЕЛЬНЫЕ шаги:

1. **Откройте Google Drive:** https://drive.google.com

2. **Найдите папку:**
   ```
   https://drive.google.com/drive/folders/1rELo6cM69I8_105PY-XKuJv1W33VDH1R
   ```

3. **Дайте доступ:**
   - Правая кнопка на папку → "Настроить доступ"
   - "Добавить пользователей и группы"
   - Email: `cosmetic-agent@cosmetic-agent.iam.gserviceaccount.com`
   - Роль: **"Редактор" (Editor)**
   - "Отправить"

4. **Проверьте:**
   - Убедитесь, что Service Account есть в списке с правами "Редактор"

---

## 📊 Логи для отладки

### Сервер (терминал):
```
🚀 Cosmetic Agent running on port 3000
📁 Google Drive Folder: 1rELo6cM69I8_105PY-XKuJv1W33VDH1R
📊 Google Sheet ID: 1JMzIi2-qNBwZsBqwDhOdJTocNjZ7BsdSXWs7cAKf3oU
🌍 Environment: development

[2025-11-27T08:29:30.889Z] POST /api/cards/C-U2025_11_26_WF-0001-0005/label
🏷️ Uploading label for card: C-U2025_11_26_WF-0001-0005
📤 Label uploaded: Этикетка Тестовый крем.pdf
📝 Extracted 1234 characters from PDF
🤖 Processing label with AI...
✅ Label processing complete for C-U2025_11_26_WF-0001-0005
```

### Браузер (Console):
```javascript
// Успешная загрузка:
{
  success: true,
  labelLink: "https://drive.google.com/file/d/xxx",
  labelFileName: "Этикетка Тестовый крем.pdf",
  aiSuggestions: {
    purpose: "Интенсивное увлажнение и питание кожи лица",
    application: "Наносить на чистую кожу лица утром и вечером"
  },
  labelInfo: "Производитель: ..., Объем: 50ml, Срок годности: 24 месяца",
  message: "Этикетка загружена и обработана AI"
}
```

---

## 🧪 Как протестировать

1. **Дайте доступ Service Account к папке** (см. выше)
2. **Откройте:** http://localhost:3000?testuser=1
3. **Создайте карточку:** Введите название → "Создать карточку"
4. **Загрузите этикетку:** Нажмите "📎 Загрузить файл"
5. **Проверьте логи:** Должны увидеть "🤖 Processing label with AI..." и "✅ Label processing complete"
6. **Проверьте поля:** "Назначение" и "Применение" должны автоматически заполниться

---

**Важно:** Без доступа Service Account к папке Drive **НИЧЕГО НЕ РАБОТАЕТ!**
