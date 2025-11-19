const express = require('express');
const router = express.Router();
const cardProcessor = require('../services/cardProcessor');

// Основной endpoint для приема данных от n8n
router.post('/', async (req, res) => {
  try {
    console.log('📨 Получен webhook от n8n:', JSON.stringify(req.body, null, 2));

    // Проверка webhook secret (опционально)
    const webhookSecret = req.headers['x-webhook-secret'];
    if (process.env.WEBHOOK_SECRET && webhookSecret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
    }

    // Валидация данных
    const { chatId, productName, purpose, application, inci, inciDocUrl, photoUrls } = req.body;

    if (!chatId || !productName) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['chatId', 'productName']
      });
    }

    // Обработка карточки
    const result = await cardProcessor.processCard({
      chatId,
      productName,
      purpose,
      application,
      inci,
      inciDocUrl,
      photoUrls: Array.isArray(photoUrls) ? photoUrls : []
    });

    console.log('✅ Карточка обработана успешно:', result.cardId);

    res.json({
      success: true,
      cardId: result.cardId,
      driveFolder: result.driveFolder,
      sheetRow: result.sheetRow,
      message: 'Карточка успешно создана'
    });

  } catch (error) {
    console.error('❌ Ошибка обработки webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
