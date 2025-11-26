const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cardProcessor = require('../services/cardProcessor');
const { authMiddleware } = require('./auth');

// Настройка multer для загрузки файлов в память
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB максимум
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'inciDoc' || file.fieldname === 'labelFile') {
      // Для INCI и этикетки принимаем PDF и изображения
      if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Документы должны быть в формате PDF или изображения'));
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

// POST /api/create-card - создание карточки через форму (требует авторизации)
router.post('/create-card', authMiddleware, upload.fields([
  { name: 'labelFile', maxCount: 1 },
  { name: 'inciDoc', maxCount: 1 },
  { name: 'photos', maxCount: 10 }
]), async (req, res) => {
  try {
    console.log('📨 Получена форма создания карточки');
    console.log('Данные:', req.body);
    console.log('Файлы:', req.files);

    // Валидация обязательных полей
    const { userEmail, userName, productName, purpose, application } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({
        success: false,
        error: 'Не заполнены обязательные поля: Email и Имя'
      });
    }

    if (!productName || !purpose || !application) {
      return res.status(400).json({
        success: false,
        error: 'Не заполнены обязательные поля: Наименование, Назначение, Применение'
      });
    }

    // INCI может быть в файле, URL или тексте
    const hasInciFile = req.files && req.files.inciDoc;
    const hasInciUrl = req.body.inciUrl;
    const hasInciText = req.body.inciText;

    if (!hasInciFile && !hasInciUrl && !hasInciText) {
      return res.status(400).json({
        success: false,
        error: 'Не указан INCI состав (загрузите файл, вставьте ссылку или текст)'
      });
    }

    // Извлечение текста из INCI
    let inciText = '';

    if (hasInciText) {
      // Если указан текст вручную
      inciText = req.body.inciText.trim();
      console.log('📝 INCI текст вставлен вручную');
    } else if (hasInciFile) {
      // Если загружен файл
      console.log('📄 Извлекаем текст из INCI документа...');
      const inciDoc = req.files.inciDoc[0];

      try {
        const pdfData = await pdfParse(inciDoc.buffer);
        inciText = pdfData.text.trim();
        console.log('✅ Текст извлечён из PDF:', inciText.substring(0, 100) + '...');
      } catch (pdfError) {
        console.error('⚠️ Ошибка извлечения текста из PDF:', pdfError);
        inciText = '[Не удалось извлечь текст из PDF]';
      }
    } else if (hasInciUrl) {
      // TODO: Загрузить файл по URL
      console.log('🔗 INCI URL указан:', req.body.inciUrl);
      inciText = `[Ссылка на INCI: ${req.body.inciUrl}]`;
    }

    // Извлечение текста из этикетки (для AI)
    let labelText = '';

    if (req.body.labelText) {
      labelText = req.body.labelText.trim();
      console.log('📋 Текст этикетки вставлен вручную');
    } else if (req.files && req.files.labelFile) {
      console.log('📋 Извлекаем текст из этикетки...');
      const labelFile = req.files.labelFile[0];

      try {
        const pdfData = await pdfParse(labelFile.buffer);
        labelText = pdfData.text.trim();
        console.log('✅ Текст этикетки извлечён:', labelText.substring(0, 100) + '...');
      } catch (error) {
        console.error('⚠️ Ошибка извлечения текста из этикетки:', error);
      }
    } else if (req.body.labelUrl) {
      console.log('🔗 Этикетка URL:', req.body.labelUrl);
      labelText = `[Ссылка на этикетку: ${req.body.labelUrl}]`;
    }

    // Подготовка данных для обработки
    const cardData = {
      userEmail, // Email пользователя
      userName, // Имя пользователя
      productName,
      purpose,
      application,
      inci: inciText,
      labelText, // Текст этикетки для AI
      inciDocBuffer: hasInciFile ? req.files.inciDoc[0].buffer : null,
      inciDocFilename: hasInciFile ? req.files.inciDoc[0].originalname : null,
      labelFileBuffer: req.files && req.files.labelFile ? req.files.labelFile[0].buffer : null,
      labelFilename: req.files && req.files.labelFile ? req.files.labelFile[0].originalname : null,
      photos: req.files && req.files.photos ? req.files.photos : [],
      // Новые поля
      tnvedCode: req.body.tnvedCode || '',
      tnvedArgument: req.body.tnvedArgument || '',
      categoryCode: req.body.categoryCode || '',
      category: req.body.category || '',
      categoryArgument: req.body.categoryArgument || ''
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
