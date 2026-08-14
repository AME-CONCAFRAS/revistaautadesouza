import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const RAW_DIR = path.resolve('./extracted-site/output/raw');
const MEDIA_DIR = path.resolve('./extracted-site/output/media');
const PAGES_DIR = path.resolve('./extracted-site/output/content/pages');
const POSTS_DIR = path.resolve('./extracted-site/output/content/posts');

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

        // Decode URI components (e.g. Eur%C3%ADpedes -> Eurípedes)
        const urlDecoded = decodeURIComponent(originalUrl);
        const urlClean = urlDecoded.split('?')[0].split('#')[0];
        const filename = path.basename(urlClean);

        if (!filename) return fullMatch;

        // Try exact match in local media catalog
        let localRelPath = fileMap.get(filename.toLowerCase()) || fileMap.get(encodeURIComponent(filename).toLowerCase());

        // Try without thumbnail resize suffix (-1024x680, -300x200, etc.)
        if (!localRelPath) {
          const unscaledFilename = filename.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, '$1');
          localRelPath = fileMap.get(unscaledFilename.toLowerCase()) || fileMap.get(encodeURIComponent(unscaledFilename).toLowerCase());
        }

        if (localRelPath) {
          modified = true;
          totalLinksFixed++;
          const newLocalUrl = `../../media/${localRelPath.replace(/\\/g, '/')}`;
          return fullMatch.replace(originalUrl, newLocalUrl);
        } else if (!originalUrl.startsWith('../../media/')) {
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
    console.log(`⚠️ Found ${missingUrls.size} un-localized image URLs referenced in post bodies. Downloading missing images...`);
    let downloadedCount = 0;
    for (const missingUrl of missingUrls) {
      if (!missingUrl || missingUrl.startsWith('data:')) continue;
      try {
        let fullUrl = missingUrl;
        if (fullUrl.includes('161.35.11.199')) {
          fullUrl = fullUrl.replace('http://161.35.11.199', 'https://www.revistaautadesouza.com');
        } else if (fullUrl.includes('srv94.teste.website/~revistaauta')) {
          fullUrl = fullUrl.replace('http://srv94.teste.website/~revistaauta', 'https://www.revistaautadesouza.com');
        } else if (!fullUrl.startsWith('http')) {
          fullUrl = `https://www.revistaautadesouza.com/${fullUrl.replace(/^\//, '')}`;
        }

        const urlObj = new URL(fullUrl);
        let relPath = decodeURIComponent(urlObj.pathname.replace(/^\/(?:wp-content\/uploads\/|public\/imagem\/)?/, ''));
        if (!relPath.startsWith('20')) {
          relPath = path.join('legacy', relPath);
        }
        const targetPath = path.join(MEDIA_DIR, relPath);

        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        const res = await fetch(fullUrl);
        if (res.ok) {
          await pipeline(res.body, createWriteStream(targetPath));
          downloadedCount++;
        } else {
          console.warn(`  ⚠️ Download status ${res.status} for ${fullUrl}`);
        }
      } catch (err) {
        console.warn(`  ⚠️ Failed downloading missing image ${missingUrl}: ${err.message}`);
      }
    }
    console.log(`🎉 Downloaded ${downloadedCount} missing inline body images! Re-running link normalization pass...`);
    
    // Re-run matching pass to update links for newly downloaded assets
    const updatedMap = await getLocalMediaMap();
    await processFolderWithMap(PAGES_DIR, updatedMap);
    await processFolderWithMap(POSTS_DIR, updatedMap);
  }
}

async function processFolderWithMap(dirPath, fileMap) {
  const files = await fs.readdir(dirPath);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(dirPath, file);
    let content = await fs.readFile(filePath, 'utf-8');
    let modified = false;

    const updatedContent = content.replace(/(?:!\[.*?\]\((.*?)\)|src=["'](.*?)["'])/g, (fullMatch, mdUrl, htmlUrl) => {
      const originalUrl = mdUrl || htmlUrl;
      if (!originalUrl || originalUrl.includes('../../media/')) return fullMatch;

      const urlDecoded = decodeURIComponent(originalUrl);
      const urlClean = urlDecoded.split('?')[0].split('#')[0];
      const filename = path.basename(urlClean);
      if (!filename) return fullMatch;

      let localRelPath = fileMap.get(filename.toLowerCase()) || fileMap.get(encodeURIComponent(filename).toLowerCase());
      if (!localRelPath) {
        const unscaledFilename = filename.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, '$1');
        localRelPath = fileMap.get(unscaledFilename.toLowerCase()) || fileMap.get(encodeURIComponent(unscaledFilename).toLowerCase());
      }

      if (localRelPath) {
        modified = true;
        const newLocalUrl = `../../media/${localRelPath.replace(/\\/g, '/')}`;
        return fullMatch.replace(originalUrl, newLocalUrl);
      }
      return fullMatch;
    });

    if (modified) {
      await fs.writeFile(filePath, updatedContent);
    }
  }
}

fixPostImageLinks().catch(console.error);
