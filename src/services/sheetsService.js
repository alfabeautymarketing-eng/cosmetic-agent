const { google } = require('googleapis');
const googleAuth = require('../config/googleAuth');

/**
 * Сервис для работы с Google Sheets API
 */
class SheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
    this.sheetName = 'Карточки'; // Имя листа в таблице
  }

  /**
   * Инициализация Google Sheets API
   */
  async initialize() {
    if (!this.sheets) {
      const auth = await googleAuth.getAuth();
      this.sheets = google.sheets({ version: 'v4', auth });
    }
    return this.sheets;
  }

  /**
   * Добавляет строку с данными карточки в таблицу
   * @param {Object} rowData - Данные карточки
   * @returns {number} - Номер добавленной строки
   */
  async addCardRow(rowData) {
    await this.initialize();

    // Структура столбцов (согласно ТЗ):
    // ID | ID-Карточки | ID-Чат | Наименование | Назначение | Применение |
    // ИНСИ | ИНСИ док | Активные ингредиенты без % | Активные ингредиенты без %Англ |
    // состав БУКЛЕТ | состав БУКЛЕТ англ | Полный состав | Полный состав англ

    const values = [
      [
        '', // ID (автоинкремент, можно оставить пустым)
        rowData.cardId, // ID-Карточки
        rowData.chatId, // ID-Чат
        rowData.productName, // Наименование
        rowData.purpose, // Назначение
        rowData.application, // Применение
        rowData.inci, // ИНСИ
        rowData.inciDocLink, // ИНСИ док (ссылка на файл)
        '', // Активные ингредиенты без % (заполнит AI)
        '', // Активные ингредиенты без %Англ (заполнит AI)
        '', // состав БУКЛЕТ (заполнит AI)
        '', // состав БУКЛЕТ англ (заполнит AI)
        '', // Полный состав (заполнит AI)
        ''  // Полный состав англ (заполнит AI)
      ]
    ];

    const resource = {
      values
    };

    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:N`, // A-N столбцы
      valueInputOption: 'USER_ENTERED',
      resource
    });

    // Получаем номер добавленной строки
    const updatedRange = response.data.updates.updatedRange;
    const rowNumber = updatedRange.match(/\d+$/)[0];

    return parseInt(rowNumber);
  }

  /**
   * Обновляет конкретную ячейку в таблице
   * @param {number} row - Номер строки
   * @param {string} column - Буква столбца (A, B, C, ...)
   * @param {string} value - Новое значение
   */
  async updateCell(row, column, value) {
    await this.initialize();

    const range = `${this.sheetName}!${column}${row}`;
    const values = [[value]];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
  }

  /**
   * Получает данные строки по ID карточки
   * @param {string} cardId - ID карточки
   * @returns {Object|null} - Данные строки или null
   */
  async getRowByCardId(cardId) {
    await this.initialize();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:N`
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // Ищем строку с нужным cardId (столбец B = индекс 1)
    const rowIndex = rows.findIndex(row => row[1] === cardId);
    if (rowIndex === -1) {
      return null;
    }

    return {
      rowNumber: rowIndex + 1,
      data: rows[rowIndex]
    };
  }
}

module.exports = new SheetsService();
