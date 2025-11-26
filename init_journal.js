require('dotenv').config();
const userService = require('./src/services/userService');

async function main() {
  try {
    console.log('Initializing User Journal...');
    await userService.ensureStructure();
    console.log('User Journal initialized successfully!');
  } catch (error) {
    console.error('Error initializing User Journal:', error);
  }
}

main();
