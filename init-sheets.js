// Load environment variables with override
const dotenv = require('dotenv');
const result = dotenv.config({ override: true });

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
  process.exit(1);
}

console.log('📊 Starting sheets initialization...');
console.log('Sheet ID:', process.env.GOOGLE_SHEET_ID);

// Clear require cache to force all services to reload
const modules = [
  './src/services/userService',
  './src/config/googleAuth'
];

modules.forEach(modulePath => {
  try {
    const resolved = require.resolve(modulePath);
    if (require.cache[resolved]) {
      delete require.cache[resolved];
    }
  } catch (e) {
    // Module not yet loaded, that's OK
  }
});

const userService = require('./src/services/userService');

console.log('Service spreadsheetId:', userService.spreadsheetId);

userService.ensureStructure()
  .then(() => {
    console.log('✅ All sheets initialized successfully!');
    console.log('Created sheets: Users, Auth, Dictionaries, Activity');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  });
