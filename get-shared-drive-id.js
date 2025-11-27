// Скрипт для получения ID Shared Drive
require('dotenv').config(); // Загружаем .env
const { google } = require('googleapis');
const googleAuth = require('./src/config/googleAuth');

async function getSharedDriveId() {
  try {
    console.log('🔍 Ищем Shared Drive...\n');

    const auth = await googleAuth.getAuth();
    const drive = google.drive({ version: 'v3', auth });

    // Получаем список всех Shared Drives
    const response = await drive.drives.list({
      fields: 'drives(id, name)'
    });

    const drives = response.data.drives || [];

    if (drives.length === 0) {
      console.log('❌ Shared Drives не найдены.');
      console.log('Убедитесь, что:');
      console.log('1. Вы создали Shared Drive (Общий диск)');
      console.log('2. Дали доступ Service Account к нему\n');
      return;
    }

    console.log('✅ Найдены Shared Drives:\n');
    drives.forEach((drive, index) => {
      console.log(`${index + 1}. Название: ${drive.name}`);
      console.log(`   ID: ${drive.id}\n`);
    });

    console.log('📋 Скопируйте ID нужного Shared Drive и добавьте в .env:');
    console.log('GOOGLE_DRIVE_SHARED_DRIVE_ID=ID_ИЗ_СПИСКА_ВЫШЕ\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);

    if (error.message.includes('drives not found')) {
      console.log('\n⚠️ У Service Account нет доступа к Shared Drives.');
      console.log('Дайте доступ Service Account к вашему Shared Drive:\n');
      console.log('1. Откройте Shared Drive в браузере');
      console.log('2. Нажмите ⚙️ → "Manage members"');
      console.log('3. Добавьте: cosmetic-agent@cosmetic-agent.iam.gserviceaccount.com');
      console.log('4. Роль: "Manager" или "Content manager"\n');
    }
  }
}

getSharedDriveId();
