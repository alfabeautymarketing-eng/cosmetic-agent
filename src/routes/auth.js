const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userService = require('../services/userService');

// Temporary storage for verification codes (in production use Redis)
const verificationCodes = new Map();

// JWT secret (in production use env variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

/**
 * POST /api/auth/register/email/send-code
 * Отправляет код подтверждения на email
 */
router.post('/register/email/send-code', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email и имя обязательны'
      });
    }

    // Генерируем 6-значный код
    const code = crypto.randomInt(100000, 999999).toString();

    // Сохраняем код на 10 минут
    verificationCodes.set(email, {
      code,
      name,
      timestamp: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 минут
    });

    // TODO: Отправить email с кодом (интеграция с email сервисом)
    console.log(`📧 Код подтверждения для ${email}: ${code}`);

    // В development mode возвращаем код (УДАЛИТЬ В PRODUCTION!)
    const response = {
      success: true,
      message: 'Код отправлен на email'
    };

    if (process.env.NODE_ENV === 'development') {
      response.code = code; // Только для разработки!
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Ошибка отправки кода:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/register/email/verify
 * Подтверждает код и создает пользователя
 */
router.post('/register/email/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email и код обязательны'
      });
    }

    // Проверяем код
    const storedData = verificationCodes.get(email);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        error: 'Код не найден или истек'
      });
    }

    if (storedData.expiresAt < Date.now()) {
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        error: 'Код истек. Запросите новый'
      });
    }

    if (storedData.code !== code) {
      return res.status(400).json({
        success: false,
        error: 'Неверный код'
      });
    }

    // Код верный, создаем пользователя
    const userData = {
      email: email,
      displayName: storedData.name,
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

    // Удаляем использованный код
    verificationCodes.delete(email);

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        userId: user.userId,
        email: user.email || email,
        name: user.name || storedData.name
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        userId: user.userId,
        email: user.email || email,
        name: user.name || storedData.name
      }
    });

  } catch (error) {
    console.error('❌ Ошибка верификации:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/login/email
 * Вход через email (отправка кода)
 */
router.post('/login/email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email обязателен'
      });
    }

    // Проверяем, существует ли пользователь
    const users = await userService.getUsers();
    const userRow = users.slice(1).find(row => row[5] === email); // Столбец F = email

    if (!userRow) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь с таким email не найден'
      });
    }

    // Генерируем код
    const code = crypto.randomInt(100000, 999999).toString();

    verificationCodes.set(email, {
      code,
      name: userRow[4], // Имя из таблицы
      timestamp: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    console.log(`📧 Код входа для ${email}: ${code}`);

    const response = {
      success: true,
      message: 'Код отправлен на email'
    };

    if (process.env.NODE_ENV === 'development') {
      response.code = code;
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Ошибка входа:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/verify-token
 * Проверяет JWT токен
 */
router.post('/verify-token', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Токен не предоставлен'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({
      success: true,
      user: {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Недействительный токен'
    });
  }
});

/**
 * Middleware для проверки авторизации
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Требуется авторизация'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;
    next();

  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Недействительный токен'
    });
  }
};

module.exports = { router, authMiddleware };
