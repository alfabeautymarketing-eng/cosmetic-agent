require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
const webhookRouter = require('./routes/webhook');
const healthRouter = require('./routes/health');
const formRouter = require('./routes/form');
const { router: authRouter } = require('./routes/auth');
const cardsRouter = require('./routes/cards');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы (веб-форма)
app.use(express.static(path.join(__dirname, '../public')));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/webhook', webhookRouter);
app.use('/api/auth', authRouter);
app.use('/api/cards', cardsRouter); // Multi-stage card creation API
app.use('/api', formRouter);

// Главная страница - редирект на форму
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const HOST = process.env.BIND_HOST || '127.0.0.1';

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Cosmetic Agent running on http://${HOST}:${PORT}`);
  console.log(`📁 Google Drive Folder: ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);
  console.log(`📊 Google Sheet ID: ${process.env.GOOGLE_SHEET_ID || 'Not set'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
