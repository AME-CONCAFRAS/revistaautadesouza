import fs from 'fs/promises';
import path from 'path';

const CONTENT_DIR = path.resolve('./output/content');
const PAGES_DIR = path.join(CONTENT_DIR, 'pages');
const POSTS_DIR = path.join(CONTENT_DIR, 'posts');
const MEDIA_DIR = path.resolve('./output/media');

async function rewriteLinksInFolder(folderPath, typeName) {
  const files = await fs.readdir(folderPath);
  let updatedCount = 0;

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(folderPath, file);
    let content = await fs.readFile(filePath, 'utf-8');

    // Replace WP absolute upload URLs with relative local media path ../../media/
    // e.g. http://.../wp-content/uploads/2020/06/image.jpg -> ../../media/2020/06/image.jpg
    const updatedContent = content.replace(
      /(https?:\/\/[^/]+(?::\d+)?|\/index\.php)?\/wp-content\/uploads\//g,
      '../../media/'
    );

    if (updatedContent !== content) {
      await fs.writeFile(filePath, updatedContent);
      updatedCount++;
    }
  }

  console.log(`✅ Rewrote image/media links in ${updatedCount}/${files.length} ${typeName} files.`);
}

async function localizeMediaLinks() {
  console.log('🔗 Localizing media links in Markdown files...');
  await rewriteLinksInFolder(PAGES_DIR, 'page');
  await rewriteLinksInFolder(POSTS_DIR, 'post');
  console.log('🎉 Link localization complete!');
}

localizeMediaLinks().catch(console.error);
