const { google } = require('googleapis');
const googleAuth = require('../config/googleAuth');

/**
 * Сервис для работы с Google Drive API
 */
class DriveService {
  constructor() {
    this.drive = null;
    this.parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
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
      fields: 'id, name, webViewLink'
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
      fields: 'id, name, webViewLink'
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
}

module.exports = new DriveService();
