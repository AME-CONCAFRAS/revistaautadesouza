import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const MEDIA_JSON_PATH = path.resolve('./output/raw/media.json');
const MEDIA_DIR = path.resolve('./output/media');

async function downloadAllMedia() {
  console.log('🖼️ Starting Media File Downloader...');
  await fs.mkdir(MEDIA_DIR, { recursive: true });

  const rawData = await fs.readFile(MEDIA_JSON_PATH, 'utf-8');
  const mediaItems = JSON.parse(rawData);

  console.log(`Found ${mediaItems.length} media records in catalog.`);

  let downloadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < mediaItems.length; i++) {
    const item = mediaItems[i];
    const sourceUrl = item.source_url;
    if (!sourceUrl) continue;

    // Preserve WP upload folder structure (e.g. 2024/05/filename.jpg)
    const urlObj = new URL(sourceUrl);
    const relativePath = urlObj.pathname.replace(/^\/wp-content\/uploads\//, '');
    const localFilePath = path.join(MEDIA_DIR, relativePath);
    const localFileDir = path.dirname(localFilePath);

    await fs.mkdir(localFileDir, { recursive: true });

    // Check if already exists
    try {
      await fs.access(localFilePath);
      skippedCount++;
      continue;
    } catch {
      // Does not exist, download
    }

    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) {
        console.warn(`  ⚠️ Failed to download (${res.status}): ${sourceUrl}`);
        errorCount++;
        continue;
      }
      await pipeline(res.body, createWriteStream(localFilePath));
      downloadedCount++;

      if (downloadedCount % 50 === 0) {
        console.log(`  Downloaded ${downloadedCount}/${mediaItems.length} files...`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Error downloading ${sourceUrl}: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n🎉 Media Download Complete!');
  console.log(`- Downloaded: ${downloadedCount}`);
  console.log(`- Already existed: ${skippedCount}`);
  console.log(`- Errors: ${errorCount}`);
}

downloadAllMedia().catch(err => {
  console.error('❌ Media download failed:', err);
});
