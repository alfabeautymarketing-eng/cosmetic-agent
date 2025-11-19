const axios = require('axios');

/**
 * Утилита для скачивания файлов
 */
class FileDownloader {
  /**
   * Скачивает файл по URL
   * @param {string} url - URL файла
   * @returns {Promise<Buffer>} - Содержимое файла
   */
  async download(url) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 секунд
        maxContentLength: 50 * 1024 * 1024, // 50MB max
        headers: {
          'User-Agent': 'Cosmetic-Agent/1.0'
        }
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error(`Ошибка скачивания файла ${url}:`, error.message);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Определяет расширение файла по URL
   * @param {string} url - URL файла
   * @returns {string|null} - Расширение файла
   */
  getFileExtension(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      return match ? match[1].toLowerCase() : null;
    } catch {
      return null;
    }
  }

  /**
   * Получает MIME тип по расширению файла
   * @param {string} extension - Расширение файла
   * @returns {string} - MIME тип
   */
  getMimeType(extension) {
    const mimeTypes = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'heic': 'image/heic'
    };

    return mimeTypes[extension?.toLowerCase()] || 'application/octet-stream';
  }
}

module.exports = new FileDownloader();
