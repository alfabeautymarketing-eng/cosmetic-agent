const driveService = require('./driveService');
const sheetsService = require('./sheetsService');
const fileDownloader = require('../utils/fileDownloader');

/**
 * Основная логика обработки карточки продукта
 */
class CardProcessor {
  /**
   * Генерирует уникальный ID карточки
   */
  generateCardId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `CARD-${timestamp}-${random}`;
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
    const cardId = this.generateCardId();
    console.log(`🔄 Начинаем обработку карточки ${cardId} из веб-формы`);

    try {
      // 1. Создаем папку в Google Drive
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
        chatId: data.chatId,
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
