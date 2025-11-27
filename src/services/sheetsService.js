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

    // Новая структура столбцов (21 колонка A-U):
    // A: ID | B: ID-Карточки | C: ID-Чат | D: Наименование |
    // E: Этикетка ссылка | F: Этикетки инфа | G: Назначение | H: Применение |
    // I: ИНСИ | J: ИНСИ док | K: Активные ингредиенты без % | L: Активные ингредиенты без %Англ |
    // M: состав БУКЛЕТ | N: состав БУКЛЕТ англ | O: Полный состав | P: Полный состав англ |
    // Q: Код ТН ВЭД | R: Аргумент кода | S: Код категории | T: Категория | U: Аргумент категории

    const values = [
      [
        '', // A: ID (автоинкремент, можно оставить пустым)
        rowData.cardId, // B: ID-Карточки
        rowData.chatId, // C: ID-Чат (User ID)
        rowData.productName, // D: Наименование
        rowData.labelLink || '', // E: Этикетка ссылка (НОВАЯ)
        rowData.labelInfo || '', // F: Этикетки инфа (НОВАЯ - заполнит AI)
        rowData.purpose, // G: Назначение (было E)
        rowData.application, // H: Применение (было F)
        rowData.inci || '', // I: ИНСИ (было G)
        rowData.inciDocLink || '', // J: ИНСИ док (было H)
        '', // K: Активные ингредиенты без % (было I - заполнит AI)
        '', // L: Активные ингредиенты без %Англ (было J - заполнит AI)
        '', // M: состав БУКЛЕТ (было K - заполнит AI)
        '', // N: состав БУКЛЕТ англ (было L - заполнит AI)
        '', // O: Полный состав (было M - заполнит AI)
        '', // P: Полный состав англ (было N - заполнит AI)
        rowData.tnvedCode || '', // Q: Код ТН ВЭД (было O)
        rowData.tnvedArgument || '', // R: Аргумент кода (было P)
        rowData.categoryCode || '', // S: Код категории (было Q)
        rowData.category || '', // T: Категория (было R)
        rowData.categoryArgument || '' // U: Аргумент категории (было S)
      ]
    ];

    const resource = {
      values
    };

    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:U`, // A-U столбцы (21 столбец, было 19)
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
      range: `${this.sheetName}!A:U` // A-U столбцы (21 столбец)
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

  /**
   * Получает все строки из таблицы
   * @returns {Promise<Array>} - Массив строк (массивов значений)
   */
  async getRows() {
    await this.initialize();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:U` // A-U столбцы (21 столбец)
    });

    return response.data.values || [];
  }

  /**
   * Обновляет строку данными AI
   * @param {number} rowNumber - Номер строки (1-based)
   * @param {Object} aiData - Данные от AI
   */
  async updateRowWithAiData(rowNumber, aiData) {
    await this.initialize();

    // Столбцы K-P (индексы 10-15) - сдвинуты на 2 позиции из-за новых колонок E и F
    // K: Активные ингредиенты без %
    // L: Активные ингредиенты без %Англ
    // M: состав БУКЛЕТ
    // N: состав БУКЛЕТ англ
    // O: Полный состав
    // P: Полный состав англ

    const values = [[
      aiData.activeIngredients.join(', '),
      aiData.activeIngredientsEn.join(', '),
      aiData.bookletComposition,
      aiData.bookletCompositionEn,
      aiData.fullComposition,
      aiData.fullCompositionEn
    ]];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!K${rowNumber}:P${rowNumber}`, // Изменено с I:N на K:P
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
  }

  /**
   * Обновляет Назначение и Применение (столбцы G и H)
   * @param {number} rowNumber - Номер строки (1-based)
   * @param {string} purpose - Значение для столбца G
   * @param {string} application - Значение для столбца H
   */
  async updatePurposeAndApplication(rowNumber, purpose, application) {
    await this.initialize();

    const values = [[purpose, application]];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!G${rowNumber}:H${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    console.log(`✅ Purpose/Application updated for row ${rowNumber}`);
  }

  /**
   * Обновляет информацию об этикетке (ссылка и извлеченная информация)
   * @param {number} rowNumber - Номер строки (1-based)
   * @param {string} labelLink - Ссылка на файл этикетки
   * @param {string} labelInfo - Извлеченная AI информация из этикетки
   */
  async updateLabelInfo(rowNumber, labelLink, labelInfo) {
    await this.initialize();

    // Столбцы E-F
    // E: Этикетка ссылка
    // F: Этикетки инфа

    const values = [[labelLink, labelInfo]];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!E${rowNumber}:F${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    console.log(`✅ Label info updated for row ${rowNumber}`);
  }

  /**
   * Обновляет название продукта
   * @param {number} rowNumber - Номер строки (1-based)
   * @param {string} newName - Новое название продукта
   */
  async updateProductName(rowNumber, newName) {
    await this.initialize();

    // Столбец D: Наименование
    await this.updateCell(rowNumber, 'D', newName);

    console.log(`✅ Product name updated to: ${newName}`);
  }
}

module.exports = new SheetsService();
