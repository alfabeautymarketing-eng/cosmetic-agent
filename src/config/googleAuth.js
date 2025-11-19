const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

/**
 * Конфигурация Google API авторизации
 */
class GoogleAuth {
  constructor() {
    this.auth = null;
  }

  /**
   * Получает авторизацию для Google APIs
   * @returns {GoogleAuth} - Объект авторизации
   */
  async getAuth() {
    if (this.auth) {
      return this.auth;
    }

    try {
      // Способ 1: Загрузка из переменной окружения (JSON строка)
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets'
          ]
        });
      }
      // Способ 2: Загрузка из файла
      else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
        const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
        const keyFileContent = await fs.readFile(keyPath, 'utf8');
        const credentials = JSON.parse(keyFileContent);

        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets'
          ]
        });
      } else {
        throw new Error(
          'Google credentials not found. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_PATH'
        );
      }

      const client = await this.auth.getClient();
      console.log('✅ Google API авторизация успешна');

      return this.auth;
    } catch (error) {
      console.error('❌ Ошибка авторизации Google API:', error.message);
      throw error;
    }
  }
}

module.exports = new GoogleAuth();
