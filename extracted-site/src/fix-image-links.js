import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const RAW_DIR = path.resolve('./output/raw');
const MEDIA_DIR = path.resolve('./output/media');
const PAGES_DIR = path.resolve('./output/content/pages');
const POSTS_DIR = path.resolve('./output/content/posts');

async function getLocalMediaMap() {
  const fileMap = new Map();

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        const relPath = fullPath.replace(MEDIA_DIR, '').replace(/^[/\\]/, '');
        // Map filename without resize suffix (e.g., man-802062_1920-1-1024x680.jpg -> man-802062_1920-1.jpg)
        const baseName = entry.name;
        fileMap.set(baseName.toLowerCase(), relPath);

        // Also add clean name without dimensions like -1024x680
        const unscaledName = baseName.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, '$1');
        if (!fileMap.has(unscaledName.toLowerCase())) {
          fileMap.set(unscaledName.toLowerCase(), relPath);
        }
      }
    }
  }

  await walk(MEDIA_DIR);
  return fileMap;
}

async function fixPostImageLinks() {
  console.log('🔧 Scanning and fixing image link references in Markdown files...');
  const fileMap = await getLocalMediaMap();

  let totalLinksFixed = 0;
  const missingUrls = new Set();

  async function processFolder(dirPath) {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(dirPath, file);
      let content = await fs.readFile(filePath, 'utf-8');

      // Match markdown image links: ![](path) or <img src="path">
      let modified = false;

      // Replace image paths in markdown
      const updatedContent = content.replace(/(?:!\[.*?\]\((.*?)\)|src=["'](.*?)["'])/g, (fullMatch, mdUrl, htmlUrl) => {
        const originalUrl = mdUrl || htmlUrl;
        if (!originalUrl) return fullMatch;

        // Extract filename from URL
        const urlClean = originalUrl.split('?')[0].split('#')[0];
        const filename = path.basename(urlClean);

        if (!filename) return fullMatch;

        // Try exact match in local media catalog
        let localRelPath = fileMap.get(filename.toLowerCase());

        // Try without thumbnail resize suffix (-1024x680, -300x200, etc.)
        if (!localRelPath) {
          const unscaledFilename = filename.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, '$1');
          localRelPath = fileMap.get(unscaledFilename.toLowerCase());
        }

        if (localRelPath) {
          modified = true;
          totalLinksFixed++;
          const newLocalUrl = `../../media/${localRelPath.replace(/\\/g, '/')}`;
          return fullMatch.replace(originalUrl, newLocalUrl);
        } else if (originalUrl.includes('wp-content/uploads')) {
          missingUrls.add(originalUrl);
        }

        return fullMatch;
      });

      if (modified) {
        await fs.writeFile(filePath, updatedContent);
      }
    }
  }

  await processFolder(PAGES_DIR);
  await processFolder(POSTS_DIR);

  console.log(`✅ Successfully normalized ${totalLinksFixed} image references to local files.`);

  if (missingUrls.size > 0) {
    console.log(`⚠️ Found ${missingUrls.size} image URLs referenced in post bodies that were not in WP media catalog. Downloading missing images...`);
    let downloadedCount = 0;
    for (const missingUrl of missingUrls) {
      try {
        const fullUrl = missingUrl.startsWith('http') ? missingUrl : `https://www.revistaautadesouza.com/${missingUrl.replace(/^\//, '')}`;
        const urlObj = new URL(fullUrl);
        const relPath = urlObj.pathname.replace(/^\/wp-content\/uploads\//, '');
        const targetPath = path.join(MEDIA_DIR, relPath);

        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        const res = await fetch(fullUrl);
        if (res.ok) {
          await pipeline(res.body, createWriteStream(targetPath));
          downloadedCount++;
        }
      } catch (err) {
        console.warn(`  ⚠️ Failed downloading missing image ${missingUrl}: ${err.message}`);
      }
    }
    console.log(`🎉 Downloaded ${downloadedCount} missing inline body images!`);
  }
}

fixPostImageLinks().catch(console.error);
