const { google } = require('googleapis');
const googleAuth = require('../config/googleAuth');

/**
 * Сервис для работы с Google Drive API
 */
class DriveService {
  constructor() {
    this.drive = null;
    this.parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || null;
  }

  /**
   * Инициализация Google Drive API
   */
  async initialize() {
    if (!this.drive) {
      const auth = await googleAuth.getAuth();
      this.drive = google.drive({ version: 'v3', auth });
    }
    return this.drive;
  }

  /**
   * Helper: нужно ли использовать Shared Drive флаги
   */
  isSharedDrive() {
    return Boolean(this.sharedDriveId);
  }

  /**
   * Опции для файловых операций в Shared Drive
   */
  getCreateOptions() {
    return this.isSharedDrive() ? { supportsAllDrives: true } : {};
  }

  getListOptions() {
    return this.isSharedDrive()
      ? {
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: 'drive',
          driveId: this.sharedDriveId
        }
      : {};
  }

  getGetOptions() {
    return this.isSharedDrive() ? { supportsAllDrives: true } : {};
  }

  /**
   * Создает папку в Google Drive
   * @param {string} folderName - Имя папки
   * @returns {string} - ID созданной папки
   */
  async createFolder(folderName) {
    await this.initialize();

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [this.parentFolderId]
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, webViewLink',
      ...this.getCreateOptions()
    });

    return response.data.id;
  }

  /**
   * Загружает файл в Google Drive
   * @param {string} fileName - Имя файла
   * @param {Buffer} fileBuffer - Содержимое файла
   * @param {string} mimeType - MIME тип файла
   * @param {string} folderId - ID папки
   * @returns {string} - ID загруженного файла
   */
  async uploadFile(fileName, fileBuffer, mimeType, folderId) {
    await this.initialize();

    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: mimeType,
      body: require('stream').Readable.from(fileBuffer)
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
      ...this.getCreateOptions()
    });

    return response.data.id;
  }

  /**
   * Получает URL папки
   * @param {string} folderId - ID папки
   * @returns {string} - URL папки
   */
  getFolderUrl(folderId) {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }

  /**
   * Получает URL файла
   * @param {string} fileId - ID файла
   * @returns {string} - URL файла
   */
  getFileUrl(fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  /**
   * Ищет папку по имени
   * @param {string} folderName - Имя папки
   * @returns {Promise<string|null>} - ID папки или null
   */
  async findFolderByName(folderName) {
    await this.initialize();

    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${this.parentFolderId}' in parents and trashed=false`;
    const response = await this.drive.files.list({
      q: query,
      fields: 'files(id, name)',
      ...(this.isSharedDrive() ? this.getListOptions() : { spaces: 'drive' })
    });

    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    }
    return null;
  }

  /**
   * Получает список файлов в папке
   * @param {string} folderId - ID папки
   * @returns {Promise<Array>} - Список файлов
   */
  async listFiles(folderId) {
    await this.initialize();

    const query = `'${folderId}' in parents and trashed=false`;
    const response = await this.drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType)',
      ...(this.isSharedDrive() ? this.getListOptions() : { spaces: 'drive' })
    });

    return response.data.files || [];
  }

  /**
   * Скачивает файл
   * @param {string} fileId - ID файла
   * @returns {Promise<{buffer: Buffer, mimeType: string}>} - Данные файла
   */
  async getFile(fileId) {
    await this.initialize();

    const response = await this.drive.files.get({
      fileId: fileId,
      alt: 'media',
      ...this.getGetOptions()
    }, { responseType: 'arraybuffer' });

    // Get mimeType from metadata
    const metaResponse = await this.drive.files.get({
      fileId: fileId,
      fields: 'mimeType',
      ...this.getGetOptions()
    });

    return {
      buffer: Buffer.from(response.data),
      mimeType: metaResponse.data.mimeType
    };
  }

  /**
   * Создает или находит папку пользователя
   * @param {string} userId - User ID
   * @returns {Promise<string>} - ID папки пользователя
   */
  async createUserFolder(userId) {
    // Проверяем, существует ли папка пользователя
    const existingFolder = await this.findFolderByName(userId);
    if (existingFolder) {
      console.log(`📁 User folder exists: ${userId}`);
      return existingFolder;
    }

    // Создаем новую папку пользователя
    console.log(`📁 Creating user folder: ${userId}`);
    return await this.createFolder(userId);
  }

  /**
   * Создает папку карточки внутри папки пользователя
   * @param {string} cardFolderName - Название папки карточки (CardID + Название продукта)
   * @param {string} userFolderId - ID папки пользователя
   * @returns {Promise<string>} - ID папки карточки
   */
  async createCardFolder(cardFolderName, userFolderId) {
    await this.initialize();

    const fileMetadata = {
      name: cardFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [userFolderId]
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, webViewLink',
      ...this.getCreateOptions()
    });

    console.log(`📁 Card folder created: ${cardFolderName}`);
    return response.data.id;
  }

  /**
   * Создает подпапку "Фото" внутри папки карточки
   * @param {string} cardFolderId - ID папки карточки
   * @returns {Promise<string>} - ID папки фото
   */
  async createPhotosFolder(cardFolderId) {
    await this.initialize();

    const fileMetadata = {
      name: 'Фото',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [cardFolderId]
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name',
      ...this.getCreateOptions()
    });

    console.log(`📸 Photos folder created in card folder`);
    return response.data.id;
  }

  /**
   * Переименовывает папку
   * @param {string} folderId - ID папки для переименования
   * @param {string} newName - Новое название папки
   */
  async renameFolder(folderId, newName) {
    await this.initialize();

    await this.drive.files.update({
      fileId: folderId,
      requestBody: {
        name: newName
      },
      ...this.getCreateOptions()
    });

    console.log(`📝 Folder renamed to: ${newName}`);
  }
}

module.exports = new DriveService();
