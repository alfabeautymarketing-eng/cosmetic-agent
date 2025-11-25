require('dotenv').config();
const express = require('express');
const webhookRouter = require('./routes/webhook');
const healthRouter = require('./routes/health');
const batchService = require('./services/batchService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/webhook', webhookRouter);

// Batch processing endpoint
app.post('/process-batch', async (req, res) => {
  try {
    // Run in background (don't wait for completion)
    batchService.processUnprocessedRows().then(result => {
      console.log('Batch processing completed:', result);
    }).catch(err => {
      console.error('Batch processing failed:', err);
    });

    res.json({ message: 'Batch processing started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Cosmetic Agent running on port ${PORT}`);
  console.log(`📁 Google Drive Folder: ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);
  console.log(`📊 Google Sheet ID: ${process.env.GOOGLE_SHEET_ID || 'Not set'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
