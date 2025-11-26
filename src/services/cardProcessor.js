const driveService = require('./driveService');
const sheetsService = require('./sheetsService');
const userService = require('./userService');
const fileDownloader = require('../utils/fileDownloader');

/**
 * Основная логика обработки карточки продукта
 */
class CardProcessor {
  /**
   * Генерирует уникальный ID карточки (старый формат, для обратной совместимости)
   */
  generateCardId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `CARD-${timestamp}-${random}`;
  }

  /**
   * Генерирует Card ID с User ID и счетчиком карточек
   * Формат: CARD-U2025_11_25_WF-0001-C0001
   * @param {string} userId - User ID (например: U2025_11_25_WF-0001)
   * @param {number} cardNumber - Порядковый номер карточки пользователя
   * @returns {string} - Card ID
   */
  generateCardIdWithUser(userId, cardNumber) {
    const cardSeq = cardNumber.toString().padStart(4, '0');
    return `CARD-${userId}-C${cardSeq}`;
  }

  /**
   * Получает количество карточек пользователя из Google Sheets
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Количество карточек
   */
  async getUserCardCount(userId) {
    const rows = await sheetsService.getRows();
    // Пропускаем заголовок (первая строка)
    const dataRows = rows.slice(1);
    // Считаем карточки, где ID-Карточки содержит userId
    const userCards = dataRows.filter(row => {
      const cardId = row[1]; // Столбец B (ID-Карточки)
      return cardId && cardId.includes(userId);
    });
    return userCards.length;
  }

  /**
   * Обрабатывает карточку продукта
   * @param {Object} data - Данные карточки от n8n
   * @returns {Object} - Результат обработки
   */
  async processCard(data) {
    const cardId = this.generateCardId();
    console.log(`🔄 Начинаем обработку карточки ${cardId}`);

    try {
      // 1. Создаем папку в Google Drive
      const folderName = `[${cardId}] ${data.productName}`;
      const folderId = await driveService.createFolder(folderName);
      console.log(`📁 Папка создана: ${folderName} (${folderId})`);

      // 2. Скачиваем и загружаем файлы
      const uploadedFiles = [];

      // 2.1 INCI документ
      if (data.inciDocUrl) {
        try {
          const inciBuffer = await fileDownloader.download(data.inciDocUrl);
          const inciFileId = await driveService.uploadFile(
            'INCI.pdf',
            inciBuffer,
            'application/pdf',
            folderId
          );
          uploadedFiles.push({ name: 'INCI.pdf', id: inciFileId });
          console.log(`📄 INCI документ загружен`);
        } catch (error) {
          console.error('⚠️ Ошибка загрузки INCI документа:', error.message);
        }
      }

      // 2.2 Фотографии
      if (data.photoUrls && data.photoUrls.length > 0) {
        for (let i = 0; i < data.photoUrls.length; i++) {
          try {
            const photoBuffer = await fileDownloader.download(data.photoUrls[i]);
            const ext = fileDownloader.getFileExtension(data.photoUrls[i]) || 'jpg';
            const photoName = `photo_${i + 1}.${ext}`;
            const photoFileId = await driveService.uploadFile(
              photoName,
              photoBuffer,
              `image/${ext}`,
              folderId
            );
            uploadedFiles.push({ name: photoName, id: photoFileId });
            console.log(`🖼 Фото ${i + 1} загружено`);
          } catch (error) {
            console.error(`⚠️ Ошибка загрузки фото ${i + 1}:`, error.message);
          }
        }
      }

      // 3. Получаем ссылку на папку
      const folderUrl = driveService.getFolderUrl(folderId);

      // 4. Получаем ссылку на INCI документ
      const inciDocFile = uploadedFiles.find(f => f.name === 'INCI.pdf');
      const inciDocLink = inciDocFile
        ? driveService.getFileUrl(inciDocFile.id)
        : '';

      // 5. Добавляем запись в Google Sheets
      const rowData = {
        cardId,
        chatId: data.chatId,
        productName: data.productName,
        purpose: data.purpose || '',
        application: data.application || '',
        inci: data.inci || '',
        inciDocLink,
        folderUrl
      };

      const sheetRow = await sheetsService.addCardRow(rowData);
      console.log(`📊 Запись добавлена в Google Sheets: строка ${sheetRow}`);

      return {
        cardId,
        driveFolder: {
          id: folderId,
          url: folderUrl,
          uploadedFiles
        },
        sheetRow
      };

    } catch (error) {
      console.error(`❌ Ошибка обработки карточки ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Обрабатывает карточку продукта с файлами из веб-формы
   * @param {Object} data - Данные карточки с буферами файлов
   * @returns {Object} - Результат обработки
   */
  async processCardWithFiles(data) {
    console.log(`🔄 Начинаем обработку карточки из веб-формы`);

    try {
      // 1. Получаем или создаем пользователя
      console.log(`👤 Получаем/создаем пользователя: ${data.userEmail}`);
      const userData = {
        email: data.userEmail,
        displayName: data.userName,
        channelCode: 'WF',
        channelName: 'Web Form',
        language: 'ru',
        role: 'user',
        status: 'active',
        consent: true
      };

      const user = await userService.getOrCreateUser(userData);

      if (!user || !user.userId) {
        throw new Error('Не удалось создать пользователя');
      }

      console.log(`✅ Пользователь: ${user.userId}`);

      // 2. Генерируем Card ID с User ID
      const cardCount = await this.getUserCardCount(user.userId);
      const cardNumber = cardCount + 1; // Следующая карточка
      const cardId = this.generateCardIdWithUser(user.userId, cardNumber);
      console.log(`🆔 Card ID: ${cardId} (карточка #${cardNumber})`);

      // 3. Создаем папку в Google Drive
      const folderName = `[${cardId}] ${data.productName}`;
      const folderId = await driveService.createFolder(folderName);
      console.log(`📁 Папка создана: ${folderName} (${folderId})`);

      // 2. Загружаем файлы
      const uploadedFiles = [];

      // 2.1 Этикетка
      if (data.labelFileBuffer) {
        try {
          const labelFileId = await driveService.uploadFile(
            data.labelFilename || 'Label.pdf',
            data.labelFileBuffer,
            'application/pdf',
            folderId
          );
          uploadedFiles.push({ name: data.labelFilename || 'Label.pdf', id: labelFileId });
          console.log(`📋 Этикетка загружена`);
        } catch (error) {
          console.error('⚠️ Ошибка загрузки этикетки:', error.message);
        }
      }

      // 2.2 INCI документ
      if (data.inciDocBuffer) {
        try {
          const inciFileId = await driveService.uploadFile(
            data.inciDocFilename || 'INCI.pdf',
            data.inciDocBuffer,
            'application/pdf',
            folderId
          );
          uploadedFiles.push({ name: data.inciDocFilename || 'INCI.pdf', id: inciFileId });
          console.log(`📄 INCI документ загружен`);
        } catch (error) {
          console.error('⚠️ Ошибка загрузки INCI документа:', error.message);
        }
      }

      // 2.2 Фотографии
      if (data.photos && data.photos.length > 0) {
        for (let i = 0; i < data.photos.length; i++) {
          try {
            const photo = data.photos[i];
            const photoFileId = await driveService.uploadFile(
              photo.originalname,
              photo.buffer,
              photo.mimetype,
              folderId
            );
            uploadedFiles.push({ name: photo.originalname, id: photoFileId });
            console.log(`🖼 Фото ${i + 1} загружено: ${photo.originalname}`);
          } catch (error) {
            console.error(`⚠️ Ошибка загрузки фото ${i + 1}:`, error.message);
          }
        }
      }

      // 3. Получаем ссылку на папку
      const folderUrl = driveService.getFolderUrl(folderId);

      // 4. Получаем ссылку на INCI документ
      const inciDocFile = uploadedFiles.find(f => f.name.includes('INCI') || f.name.endsWith('.pdf'));
      const inciDocLink = inciDocFile
        ? driveService.getFileUrl(inciDocFile.id)
        : '';

      // 5. Добавляем запись в Google Sheets
      const rowData = {
        cardId,
        chatId: user.userId, // Теперь храним User ID вместо Chat ID
        productName: data.productName,
        purpose: data.purpose || '',
        application: data.application || '',
        inci: data.inci || '',
        inciDocLink,
        folderUrl,
        // Новые поля
        tnvedCode: data.tnvedCode || '',
        tnvedArgument: data.tnvedArgument || '',
        categoryCode: data.categoryCode || '',
        category: data.category || '',
        categoryArgument: data.categoryArgument || ''
      };

      const sheetRow = await sheetsService.addCardRow(rowData);
      console.log(`📊 Запись добавлена в Google Sheets: строка ${sheetRow}`);

      // 6. TODO: Запускаем AI обработку асинхронно
      // this.processWithAI(cardId, data.inci, data.labelText, sheetRow);

      return {
        cardId,
        driveFolder: {
          id: folderId,
          url: folderUrl,
          uploadedFiles
        },
        sheetRow
      };

    } catch (error) {
      console.error(`❌ Ошибка обработки карточки ${cardId}:`, error);
      throw error;
    }
  }
}

module.exports = new CardProcessor();
