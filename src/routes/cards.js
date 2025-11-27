const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const driveService = require('../services/driveService');
const sheetsService = require('../services/sheetsService');
const aiService = require('../services/aiService');
const cardProcessor = require('../services/cardProcessor');
const { authMiddleware } = require('./auth');

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат файла'));
    }
  }
});

/**
 * STAGE 1: Create card with basic product info
 * POST /api/cards/create
 *
 * Creates new card with:
 * - Card ID in format C-UserID-number
 * - Folder structure: /UserID/CardID ProductName/
 * - Photos subfolder
 * - Initial row in Google Sheets
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { productName, purpose, application } = req.body;
    const { userId, email, name } = req.user; // From JWT token

    console.log(`📝 Creating card for user: ${userId}`);

    // Validate required fields
    if (!productName || !purpose || !application) {
      return res.status(400).json({
        success: false,
        error: 'Заполните все обязательные поля: Наименование, Назначение, Применение'
      });
    }

    // Generate Card ID
    const cardCount = await cardProcessor.getUserCardCount(userId);
    const cardNumber = cardCount + 1;
    const cardId = cardProcessor.generateCardIdWithUser(userId, cardNumber);

    console.log(`🆔 Generated Card ID: ${cardId}`);

    // Create folder structure
    // 1. Get or create user folder
    const userFolderId = await driveService.createUserFolder(userId);

    // 2. Create card folder inside user folder
    const cardFolderName = `${cardId} ${productName}`;
    const cardFolderId = await driveService.createCardFolder(cardFolderName, userFolderId);

    // 3. Create Photos subfolder
    const photosFolderId = await driveService.createPhotosFolder(cardFolderId);

    const folderUrl = driveService.getFolderUrl(cardFolderId);

    console.log(`📁 Folder structure created: ${folderUrl}`);

    // Add initial row to Google Sheets with partial data
    const rowData = {
      cardId,
      chatId: userId,
      productName,
      purpose,
      application,
      inci: '', // Will be filled later
      inciDocLink: '', // Will be filled later
      labelLink: '', // Will be filled in stage 2
      labelInfo: '' // Will be filled in stage 2
    };

    const sheetRow = await sheetsService.addCardRow(rowData);

    console.log(`✅ Card created successfully: ${cardId} at row ${sheetRow}`);

    res.json({
      success: true,
      cardId,
      cardFolderId,
      userFolderId,
      photosFolderId,
      sheetRow,
      folderUrl,
      message: 'Карточка создана. Теперь можно загрузить этикетку.'
    });

  } catch (error) {
    console.error('❌ Error creating card:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * STAGE 2: Upload label and process with AI
 * POST /api/cards/:cardId/label
 *
 * Processes label file:
 * - Uploads to Drive in card folder
 * - Extracts text from PDF/image
 * - Processes with AI to extract label info
 * - Suggests purpose and application
 * - Updates columns E and F in Sheets
 */
router.post('/:cardId/label', authMiddleware, upload.array('labelFile', 10), async (req, res) => {
  try {
    const { cardId } = req.params;
    const { cardFolderId, productName } = req.body;

    console.log(`🏷️ Uploading label for card: ${cardId}`);

    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        error: 'Файл этикетки не загружен'
      });
    }

    const labelFilesMeta = [];
    const imageAttachments = [];
    let aggregatedLabelText = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExtension = file.originalname.split('.').pop();
      const suffix = files.length > 1 ? ` (${i + 1})` : '';
      const labelFileName = `Этикетка ${productName}${suffix}.${fileExtension}`;

      const labelFileId = await driveService.uploadFile(
        labelFileName,
        file.buffer,
        file.mimetype,
        cardFolderId
      );

      const labelLink = driveService.getFileUrl(labelFileId);
      labelFilesMeta.push({ name: labelFileName, link: labelLink, mimeType: file.mimetype });

      console.log(`📤 Label uploaded: ${labelFileName}`);

      try {
        if (file.mimetype === 'application/pdf') {
          const pdfData = await pdfParse(file.buffer);
          const labelText = pdfData.text.trim();
          aggregatedLabelText += (aggregatedLabelText ? '\n\n' : '') + labelText;
          console.log(`📝 Extracted ${labelText.length} characters from PDF ${labelFileName}`);
        } else if (file.mimetype.startsWith('image/')) {
          imageAttachments.push({ buffer: file.buffer, mimeType: file.mimetype });
        }
      } catch (error) {
        console.error('⚠️ PDF/image parsing error:', error.message);
      }
    }

    // Process with AI (label analysis)
    console.log(`🤖 Processing label with AI...`);
    const aiResult = await aiService.analyzeLabelOnly(
      { productName, labelText: aggregatedLabelText },
      imageAttachments
    );

    // Update Sheets with label link and AI-extracted info
    const cardRow = await sheetsService.getRowByCardId(cardId);
    if (cardRow) {
      const labelInfo = aiResult.labelInfo || '';
      const cleanedPurpose = (aiResult.suggestedPurpose || '').trim();
      const cleanedApplication = (aiResult.suggestedApplication || '').trim();

      await sheetsService.updateLabelInfo(
        cardRow.rowNumber,
        labelFilesMeta[0]?.link || '',
        labelInfo
      );

      if (cleanedPurpose || cleanedApplication) {
        const currentPurpose = cardRow.data?.[6] || '';
        const currentApplication = cardRow.data?.[7] || '';

        await sheetsService.updatePurposeAndApplication(
          cardRow.rowNumber,
          cleanedPurpose || currentPurpose,
          cleanedApplication || currentApplication
        );
      }
    }

    console.log(`✅ Label processing complete for ${cardId}`);

    res.json({
      success: true,
      labelLink: labelFilesMeta[0]?.link || '',
      labelFileName: labelFilesMeta.map(f => f.name).join(', '),
      labelFiles: labelFilesMeta,
      aiSuggestions: {
        purpose: (aiResult.suggestedPurpose || '').trim(),
        application: (aiResult.suggestedApplication || '').trim()
      },
      labelInfo: aiResult.labelInfo || '',
      message: 'Этикетка загружена и обработана AI'
    });

  } catch (error) {
    console.error('❌ Error uploading label:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update purpose/application values
 * PATCH /api/cards/:cardId/info
 *
 * Persists Назначение и Применение in Sheets (columns G and H)
 */
router.patch('/:cardId/info', authMiddleware, async (req, res) => {
  try {
    const { cardId } = req.params;
    const cleanPurpose = (req.body.purpose || '').trim();
    const cleanApplication = (req.body.application || '').trim();

    console.log(`✏️ Updating purpose/application for card: ${cardId}`);

    if (!cleanPurpose || !cleanApplication) {
      return res.status(400).json({
        success: false,
        error: 'Заполните поля "Назначение" и "Применение"'
      });
    }

    const cardRow = await sheetsService.getRowByCardId(cardId);
    if (!cardRow) {
      return res.status(404).json({
        success: false,
        error: 'Карточка не найдена'
      });
    }

    await sheetsService.updatePurposeAndApplication(
      cardRow.rowNumber,
      cleanPurpose,
      cleanApplication
    );

    console.log(`✅ Purpose/Application saved for ${cardId}`);

    res.json({
      success: true,
      message: 'Назначение и Применение обновлены'
    });
  } catch (error) {
    console.error('❌ Error updating purpose/application:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * STAGE 3: Upload INCI and process with AI
 * POST /api/cards/:cardId/inci
 *
 * Processes INCI document:
 * - Uploads to Drive in card folder
 * - Extracts INCI text from PDF/image
 * - Processes with AI to extract compositions
 * - Returns 3 result blocks (full, active, booklet)
 * - Updates columns I, J, and K-P in Sheets
 */
router.post('/:cardId/inci', authMiddleware, upload.single('inciFile'), async (req, res) => {
  try {
    const { cardId } = req.params;
    const { cardFolderId, productName, purpose } = req.body;

    console.log(`🧪 Uploading INCI for card: ${cardId}`);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Файл INCI не загружен'
      });
    }

    // Upload INCI file to Drive
    const fileExtension = req.file.originalname.split('.').pop();
    const inciFileName = `INCI ${productName}.${fileExtension}`;

    const inciFileId = await driveService.uploadFile(
      inciFileName,
      req.file.buffer,
      req.file.mimetype,
      cardFolderId
    );

    const inciLink = driveService.getFileUrl(inciFileId);

    console.log(`📤 INCI uploaded: ${inciFileName}`);

    // Extract text from INCI document
    let inciText = '';
    try {
      if (req.file.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(req.file.buffer);
        inciText = pdfData.text.trim();
        console.log(`📝 Extracted ${inciText.length} characters from INCI PDF`);
      }
    } catch (error) {
      console.error('⚠️ PDF parsing error:', error.message);
    }

    // Process with AI (INCI analysis)
    console.log(`🤖 Processing INCI with AI...`);
    const aiResult = await aiService.analyzeProduct(
      { productName, purpose, inci: inciText },
      req.file.buffer,
      req.file.mimetype
    );

    // Update Sheets with INCI data and AI results
    const cardRow = await sheetsService.getRowByCardId(cardId);
    if (cardRow) {
      // Update INCI text and link (columns I and J)
      await sheetsService.updateCell(cardRow.rowNumber, 'I', inciText);
      await sheetsService.updateCell(cardRow.rowNumber, 'J', inciLink);

      // Update AI-generated compositions (columns K-P)
      await sheetsService.updateRowWithAiData(cardRow.rowNumber, aiResult);
    }

    console.log(`✅ INCI processing complete for ${cardId}`);

    res.json({
      success: true,
      inciLink,
      inciFileName,
      aiResults: {
        fullComposition: {
          ru: aiResult.fullComposition,
          en: aiResult.fullCompositionEn
        },
        activeIngredients: {
          ru: aiResult.activeIngredients,
          en: aiResult.activeIngredientsEn
        },
        bookletComposition: {
          ru: aiResult.bookletComposition,
          en: aiResult.bookletCompositionEn
        }
      },
      message: 'INCI загружен и обработан AI'
    });

  } catch (error) {
    console.error('❌ Error uploading INCI:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * STAGE 4: Upload photos
 * POST /api/cards/:cardId/photos
 *
 * Uploads multiple photos:
 * - Saves to Photos subfolder in card folder
 * - Returns list of uploaded files with links
 */
router.post('/:cardId/photos', authMiddleware, upload.array('photos', 10), async (req, res) => {
  try {
    const { cardId } = req.params;
    const { photosFolderId } = req.body;

    console.log(`📸 Uploading photos for card: ${cardId}`);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Файлы не загружены'
      });
    }

    const uploadedPhotos = [];

    // Upload each photo to Photos folder
    for (const photo of req.files) {
      const photoFileId = await driveService.uploadFile(
        photo.originalname,
        photo.buffer,
        photo.mimetype,
        photosFolderId
      );

      uploadedPhotos.push({
        name: photo.originalname,
        id: photoFileId,
        url: driveService.getFileUrl(photoFileId)
      });
    }

    console.log(`✅ Uploaded ${uploadedPhotos.length} photos for ${cardId}`);

    res.json({
      success: true,
      uploadedPhotos,
      count: uploadedPhotos.length,
      message: `Загружено ${uploadedPhotos.length} фото`
    });

  } catch (error) {
    console.error('❌ Error uploading photos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update product name
 * PATCH /api/cards/:cardId/name
 *
 * Updates product name:
 * - Updates name in Sheets (column D)
 * - Renames Drive folder
 */
router.patch('/:cardId/name', authMiddleware, async (req, res) => {
  try {
    const { cardId } = req.params;
    const { newName, cardFolderId } = req.body;

    console.log(`✏️ Updating name for card: ${cardId}`);

    if (!newName) {
      return res.status(400).json({
        success: false,
        error: 'Новое название не указано'
      });
    }

    // Update in Sheets
    const cardRow = await sheetsService.getRowByCardId(cardId);
    if (!cardRow) {
      return res.status(404).json({
        success: false,
        error: 'Карточка не найдена'
      });
    }

    await sheetsService.updateProductName(cardRow.rowNumber, newName);

    // Rename Drive folder
    const newFolderName = `${cardId} ${newName}`;
    await driveService.renameFolder(cardFolderId, newFolderName);

    console.log(`✅ Name updated to: ${newName}`);

    res.json({
      success: true,
      newName,
      newFolderName,
      message: 'Название обновлено'
    });

  } catch (error) {
    console.error('❌ Error updating product name:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Submit AI feedback
 * POST /api/cards/:cardId/feedback
 *
 * Stores user feedback about AI results
 * TODO: Implement chat memory storage
 */
router.post('/:cardId/feedback', authMiddleware, async (req, res) => {
  try {
    const { cardId } = req.params;
    const { resultType, feedback, corrections } = req.body;

    console.log(`📝 Feedback for ${cardId} (${resultType}):`, feedback);

    // TODO: Store feedback in separate sheet or database for chat memory
    // This will be used to improve AI responses in future

    res.json({
      success: true,
      message: 'Обратная связь принята. Спасибо!'
    });

  } catch (error) {
    console.error('❌ Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
