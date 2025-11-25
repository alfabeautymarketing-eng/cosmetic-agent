const sheetsService = require('./sheetsService');
const driveService = require('./driveService');
const aiService = require('./aiService');
const fileDownloader = require('../utils/fileDownloader');

class BatchService {
  /**
   * Scans the sheet for rows that need processing (empty AI columns)
   * and processes them.
   */
  async processUnprocessedRows() {
    console.log('🔄 Starting batch processing...');
    const rows = await sheetsService.getRows();
    const updates = [];
    let processedCount = 0;
    const errors = [];

    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;
      
      // Check if AI columns are empty (Column I is index 8)
      // If row[8] is undefined or empty string, it needs processing
      // Also check if we have files to process (Column H is index 7 - INCI doc link)
      // or we can look for folder link (Column H is INCI doc, Column B is Card ID)
      
      // Let's rely on Card ID (index 1) and Folder URL (we might need to fetch it or reconstruct it)
      // Actually, row[7] is INCI doc link.
      
      const hasAiData = row[8] && row[8].trim() !== '';
      const cardId = row[1];
      
      if (!hasAiData && cardId) {
        console.log(`⚡ Processing row ${rowNumber} (Card ID: ${cardId})`);
        
        try {
          // 1. Prepare data for AI
          const productData = {
            productName: row[3], // D
            purpose: row[4],     // E
            inci: row[6]         // G
          };

          // 2. Try to get INCI doc or photo
          // The sheet has INCI doc link in row[7] (H)
          // But that's a web link. We need to download it.
          // Or we can list files in the Drive folder if we have the folder ID.
          // The sheet doesn't store Folder ID directly, but we can search for it or use the link if available.
          // Wait, row[7] is "ИНСИ док" link.
          
          let imageBuffer = null;
          let mimeType = 'image/jpeg';

          const inciDocLink = row[7];
          if (inciDocLink) {
             // Try to download from the link if it's a direct download link or drive link
             // For now, let's assume we can try to download it if it's accessible.
             // But drive links might need auth.
             // Better approach: Find the folder by name "[CardID] ..." and list files.
             
             // Let's try to find the folder by query
             const folderName = `[${cardId}] ${productData.productName}`;
             const folderId = await driveService.findFolderByName(folderName);
             
             if (folderId) {
               const files = await driveService.listFiles(folderId);
               // Look for INCI.pdf or images
               const inciFile = files.find(f => f.name === 'INCI.pdf');
               const photoFile = files.find(f => f.mimeType.startsWith('image/'));
               
               let fileIdToDownload = inciFile ? inciFile.id : (photoFile ? photoFile.id : null);
               
               if (fileIdToDownload) {
                 const fileData = await driveService.getFile(fileIdToDownload); // We need getFile in driveService
                 imageBuffer = fileData.buffer;
                 mimeType = fileData.mimeType;
               }
             }
          }

          // 3. Run AI
          const aiResult = await aiService.analyzeProduct(productData, imageBuffer, mimeType);
          
          // 4. Update Sheet
          await sheetsService.updateRowWithAiData(rowNumber, aiResult);
          
          processedCount++;
          updates.push(cardId);
          console.log(`✅ Row ${rowNumber} processed`);

        } catch (error) {
          console.error(`❌ Error processing row ${rowNumber}:`, error.message);
          errors.push({ row: rowNumber, error: error.message });
        }
      }
    }

    console.log(`🏁 Batch processing finished. Processed: ${processedCount}, Errors: ${errors.length}`);
    return { processed: processedCount, errors };
  }
}

module.exports = new BatchService();
