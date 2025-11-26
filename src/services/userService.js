const { google } = require('googleapis');
const googleAuth = require('../config/googleAuth');

/**
 * Service for managing the User Journal in Google Sheets
 */
class UserService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    // Sheet Names
    this.SHEET_USERS = 'Users';
    this.SHEET_AUTH = 'Auth';
    this.SHEET_DICTIONARIES = 'Dictionaries';
    this.SHEET_ACTIVITY = 'Activity';
  }

  /**
   * Initialize Google Sheets API
   */
  async initialize() {
    if (!this.sheets) {
      const auth = await googleAuth.getAuth();
      this.sheets = google.sheets({ version: 'v4', auth });
    }
    return this.sheets;
  }

  /**
   * Ensures that all required sheets and structure exist
   */
  async ensureStructure() {
    await this.initialize();

    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });

    const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);

    // 1. Create missing sheets
    const sheetsToCreate = [
      this.SHEET_USERS,
      this.SHEET_AUTH,
      this.SHEET_DICTIONARIES,
      this.SHEET_ACTIVITY
    ].filter(name => !existingSheets.includes(name));

    if (sheetsToCreate.length > 0) {
      const requests = sheetsToCreate.map(title => ({
        addSheet: {
          properties: { title }
        }
      }));

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: { requests }
      });
      console.log(`Created sheets: ${sheetsToCreate.join(', ')}`);
    }

    // 2. Setup Dictionaries (if empty)
    await this.setupDictionaries();

    // 3. Setup Users Sheet (Headers & Validation)
    await this.setupUsersSheet();

    // 4. Setup Auth Sheet
    await this.setupAuthSheet();

    // 5. Setup Activity Sheet
    await this.setupActivitySheet();
  }

  /**
   * Setup Dictionaries sheet with static data
   */
  async setupDictionaries() {
    // Check if already populated (check A1)
    const check = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.SHEET_DICTIONARIES}!A1`
    });

    if (check.data.values && check.data.values.length > 0) {
      return; // Already setup
    }

    const data = [
      ['status_code', 'status_name', '', 'channel_code', 'channel_name', '', 'role_code', 'role_name'],
      ['active', 'Активен', '', 'TG', 'Telegram', '', 'user', 'Обычный пользователь'],
      ['blocked', 'Заблокирован', '', 'GL', 'Google', '', 'admin', 'Администратор'],
      ['deleted', 'Удален', '', 'EM', 'Email', '', 'manager', 'Менеджер'],
      ['test', 'Тестовый', '', '', '', '', '', '']
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.SHEET_DICTIONARIES}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: data }
    });
  }

  /**
   * Setup Users sheet headers and validation
   */
  async setupUsersSheet() {
    // Headers
    const headers = [
      'UserID', 'Дата регистрации', 'Канал регистрации', 'Канал (код)', 
      'Имя (отображаемое)', 'Email', 'Telegram @username', 'Telegram chat_id', 
      'Google account (sub/id)', 'Страна / город', 'Язык интерфейса', 
      'Тип пользователя', 'Статус', 'Источник (UTM)', 'Последний логин', 
      'Кол-во логинов', 'Согласие на обработку данных', 'Удаление запрошено', 'Комментарий'
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.SHEET_USERS}!A1:S1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headers] }
    });

    // Freeze first row
    const sheetId = await this.getSheetId(this.SHEET_USERS);
    
    // Data Validation & Formatting
    const requests = [
      {
        updateSheetProperties: {
          properties: {
            sheetId: sheetId,
            gridProperties: { frozenRowCount: 1 }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      },
      // Validation for Channel Code (Column D -> Dictionaries!D2:D)
      {
        setDataValidation: {
          range: { sheetId: sheetId, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 }, // Col D (index 3)
          rule: {
            condition: {
              type: 'ONE_OF_RANGE',
              values: [{ userEnteredValue: `=${this.SHEET_DICTIONARIES}!D2:D` }]
            },
            showCustomUi: true,
            strict: true
          }
        }
      },
      // Validation for Type (Column L -> Dictionaries!G2:G)
      {
        setDataValidation: {
          range: { sheetId: sheetId, startRowIndex: 1, startColumnIndex: 11, endColumnIndex: 12 }, // Col L (index 11)
          rule: {
            condition: {
              type: 'ONE_OF_RANGE',
              values: [{ userEnteredValue: `=${this.SHEET_DICTIONARIES}!G2:G` }]
            },
            showCustomUi: true,
            strict: true
          }
        }
      },
      // Validation for Status (Column M -> Dictionaries!A2:A)
      {
        setDataValidation: {
          range: { sheetId: sheetId, startRowIndex: 1, startColumnIndex: 12, endColumnIndex: 13 }, // Col M (index 12)
          rule: {
            condition: {
              type: 'ONE_OF_RANGE',
              values: [{ userEnteredValue: `=${this.SHEET_DICTIONARIES}!A2:A` }]
            },
            showCustomUi: true,
            strict: true
          }
        }
      }
    ];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      resource: { requests }
    });
  }

  /**
   * Setup Auth sheet headers
   */
  async setupAuthSheet() {
    const headers = ['AuthID', 'UserID', 'Тип авторизации', 'Идентификатор', 'Дата создания', 'Статус'];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.SHEET_AUTH}!A1:F1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headers] }
    });
  }

  /**
   * Setup Activity sheet headers
   */
  async setupActivitySheet() {
    const headers = ['EventID', 'UserID', 'Дата/время', 'Тип события', 'Канал', 'Доп. данные'];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.SHEET_ACTIVITY}!A1:F1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headers] }
    });
  }

  /**
   * Helper to get Sheet ID by title
   */
  async getSheetId(title) {
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === title);
    return sheet ? sheet.properties.sheetId : null;
  }

  /**
   * Add a new user to the journal
   * @param {Object} userData
   */
  async addUser(userData) {
    await this.initialize();

    // Default values
    const regDate = userData.regDate || new Date();
    const formattedDate = regDate.toISOString().split('T')[0].replace(/-/g, '_'); // YYYY_MM_DD
    
    // Formula for UserID: =IF(B2="";"";"U" & TEXT(B2;"yyyy_mm_dd") & "_" & D2 & "-" & TEXT(ROW()-1;"0000"))
    // Note: We use INDIRECT("RC[-1]",0) or similar if we want relative, but standard notation works in append if we don't hardcode row number.
    // Actually, when appending, we don't know the row number easily in the formula string unless we use ROW().
    // Formula: ="U" & TEXT(INDIRECT("RC[1]",0), "yyyy_mm_dd") ... 
    // Easier: =IF(B:B="";"";"U"&TEXT(B:B;"yyyy_mm_dd")&"_"&D:D&"-"&TEXT(ROW()-1;"0000")) 
    // But putting B:B in a cell refers to the whole column (spill). We want relative B2.
    // When we append a row, if we use "B2" in the formula, Google Sheets might not auto-adjust it if we just paste text.
    // However, if we use R1C1 notation or just `INDIRECT`, it's safer.
    // Let's try the formula the user suggested, but using `INDIRECT` to reference "Current Row, Column B".
    // Column B is index 2. Column A is index 1.
    // Formula in Col A: ="U" & TEXT(INDIRECT("R[0]C[1]", FALSE), "yyyy_mm_dd") & "_" & INDIRECT("R[0]C[3]", FALSE) & "-" & TEXT(ROW()-1, "0000")
    // R[0]C[1] means same row, 1 column to the right (B).
    // R[0]C[3] means same row, 3 columns to the right (D).
    
    const idFormula = `=IF(INDIRECT("R[0]C[1]", FALSE)="";"";"U" & TEXT(INDIRECT("R[0]C[1]", FALSE);"yyyy_mm_dd") & "_" & INDIRECT("R[0]C[3]", FALSE) & "-" & TEXT(ROW()-1;"0000"))`;

    const rowValues = [
      idFormula, // A: UserID
      userData.regDate || new Date().toISOString(), // B: Date
      userData.channelName || '', // C: Channel Name
      userData.channelCode || '', // D: Channel Code
      userData.displayName || '', // E: Name
      userData.email || '', // F: Email
      userData.telegramUsername || '', // G: TG User
      userData.telegramChatId || '', // H: TG Chat ID
      userData.googleId || '', // I: Google ID
      userData.country || '', // J: Country
      userData.language || 'ru', // K: Lang
      userData.role || 'user', // L: Role
      userData.status || 'active', // M: Status
      userData.source || '', // N: Source
      '', // O: Last Login
      0, // P: Login Count
      userData.consent ? `yes (${new Date().toISOString()})` : 'no', // Q: Consent
      'no', // R: Delete Req
      userData.comment || '' // S: Comment
    ];

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.SHEET_USERS}!A:S`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [rowValues] }
    });

    // Return the generated ID (calculated manually for return, though sheet has formula)
    // This is an approximation since we rely on the sheet formula for the actual ID
    return idFormula; 
  }

  /**
   * Get all users from the sheet
   * @returns {Promise<Array>}
   */
  async getUsers() {
    await this.initialize();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.SHEET_USERS}!A:S`
    });
    return response.data.values || [];
  }

  /**
   * Find a user by Telegram Chat ID
   * @param {string|number} chatId
   * @returns {Promise<Object|null>}
   */
  async findUserByChatId(chatId) {
    const rows = await this.getUsers();
    if (rows.length < 2) return null; // Only headers

    // Chat ID is in column H (index 7)
    const userRow = rows.find(row => row[7] == chatId);
    
    if (userRow) {
      return {
        userId: userRow[0],
        regDate: userRow[1],
        channel: userRow[2],
        channelCode: userRow[3],
        name: userRow[4],
        email: userRow[5],
        tgUser: userRow[6],
        chatId: userRow[7]
        // ... add other fields as needed
      };
    }
    return null;
  }

  /**
   * Get existing user or create a new one
   * @param {Object} userData
   * @returns {Promise<Object>} User object with userId
   */
  async getOrCreateUser(userData) {
    if (userData.telegramChatId) {
      const existingUser = await this.findUserByChatId(userData.telegramChatId);
      if (existingUser) {
        return existingUser;
      }
    }

    await this.addUser(userData);
    
    // Fetch the user again to get the generated ID (since formula generates it)
    // We might need a small delay or just fetch by Chat ID again
    // For now, let's fetch by Chat ID
    if (userData.telegramChatId) {
      // Wait a moment for sheet to update? Usually API is fast enough but formula calculation might take a tick?
      // Actually API read returns calculated values.
      return await this.findUserByChatId(userData.telegramChatId);
    }
    
    return null;
  }
}

module.exports = new UserService();
