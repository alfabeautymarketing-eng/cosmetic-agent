const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cardProcessor = require('../services/cardProcessor');

// Настройка multer для загрузки файлов в память
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB максимум
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'inciDoc') {
      // Для INCI документа принимаем только PDF
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('INCI документ должен быть в формате PDF'));
      }
    } else if (file.fieldname === 'photos') {
      // Для фото принимаем изображения
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Можно загружать только изображения'));
      }
    } else {
      cb(null, true);
    }
  }
});

// POST /api/create-card - создание карточки через форму
router.post('/create-card', upload.fields([
  { name: 'inciDoc', maxCount: 1 },
  { name: 'photos', maxCount: 10 }
]), async (req, res) => {
  try {
    console.log('📨 Получена форма создания карточки');
    console.log('Данные:', req.body);
    console.log('Файлы:', req.files);

    // Валидация обязательных полей
    const { productName, purpose, application } = req.body;

    if (!productName || !purpose || !application) {
      return res.status(400).json({
        success: false,
        error: 'Не заполнены обязательные поля: Наименование, Назначение, Применение'
      });
    }

    if (!req.files || !req.files.inciDoc) {
      return res.status(400).json({
        success: false,
        error: 'Не загружен INCI документ (PDF)'
      });
    }

    // Извлечение текста из PDF
    console.log('📄 Извлекаем текст из INCI документа...');
    const inciDoc = req.files.inciDoc[0];
    let inciText = '';

    try {
      const pdfData = await pdfParse(inciDoc.buffer);
      inciText = pdfData.text.trim();
      console.log('✅ Текст извлечён:', inciText.substring(0, 100) + '...');
    } catch (pdfError) {
      console.error('⚠️ Ошибка извлечения текста из PDF:', pdfError);
      inciText = '[Не удалось извлечь текст из PDF]';
    }

    // Подготовка данных для обработки
    const cardData = {
      chatId: 'web-form', // Специальный ID для веб-формы
      productName,
      purpose,
      application,
      inci: inciText,
      inciDocBuffer: inciDoc.buffer, // Буфер файла для загрузки
      inciDocFilename: inciDoc.originalname,
      photos: req.files.photos || []
    };

    // Обработка карточки
    console.log('🔄 Начинаем обработку карточки...');
    const result = await cardProcessor.processCardWithFiles(cardData);

    console.log('✅ Карточка успешно создана:', result.cardId);

    res.json({
      success: true,
      cardId: result.cardId,
      driveFolder: result.driveFolder,
      sheetRow: result.sheetRow,
      sheetId: process.env.GOOGLE_SHEET_ID,
      message: 'Карточка успешно создана. AI обработка запущена.'
    });

  } catch (error) {
    console.error('❌ Ошибка обработки формы:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
