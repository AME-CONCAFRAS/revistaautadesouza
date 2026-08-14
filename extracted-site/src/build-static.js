import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';

const OUTPUT_DIR = path.resolve('./extracted-site/output');
const DIST_DIR = path.resolve('./extracted-site/dist');
const PAGES_DIR = path.join(OUTPUT_DIR, 'content', 'pages');
const POSTS_DIR = path.join(OUTPUT_DIR, 'content', 'posts');
const MEDIA_DIR = path.join(OUTPUT_DIR, 'media');
const RAW_DIR = path.join(OUTPUT_DIR, 'raw');

function parseFrontMatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { metadata: {}, body: fileContent };

  const rawYaml = match[1];
  const body = match[2];
  const metadata = {};

  rawYaml.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value.startsWith('[') && value.endsWith(']')) {
        try { value = JSON.parse(value); } catch {}
      }
      metadata[key] = value;
    }
  });

  return { metadata, body };
}

async function loadItemsFromDir(dirPath, type) {
  try {
    const files = await fs.readdir(dirPath);
    const items = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
      const { metadata, body } = parseFrontMatter(content);
      items.push({
        filename: file,
        slug: file.replace(/\.md$/, ''),
        type,
        metadata,
        body
      });
    }
    return items;
  } catch {
    return [];
  }
}

const BLOB_MEDIA_BASE = 'https://concafrascms.blob.core.windows.net/revista-autadesouza-tmp-bkp/media/';

function renderHtmlPage(title, bodyContent, rootPrefix = './', counts = { posts: 0, pages: 0 }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Revista Auta de Souza Archive</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #7dd3fc;
      --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #090d16;
      border-bottom: 1px solid var(--border);
      padding: 1.25rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    header h1 a { font-size: 1.25rem; font-weight: 700; color: #fff; text-decoration: none; }
    header h1 span { color: var(--accent); }
    nav a {
      color: var(--text-muted);
      text-decoration: none;
      margin-left: 1.5rem;
      font-weight: 500;
      transition: color 0.2s;
    }
    nav a:hover, nav a.active { color: var(--accent); }
    main {
      flex: 1;
      max-width: 1100px;
      width: 100%;
      margin: 2rem auto;
      padding: 0 1.5rem;
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 4px;
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
    }
    .card h2 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0.5rem 0;
      color: #fff;
    }
    .card .meta {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }
    .card a.btn {
      align-self: flex-start;
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .card a.btn:hover { text-decoration: underline; }
    
    /* Article view styling */
    .article-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2.5rem;
    }
    .article-header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    .article-header h1 {
      font-family: 'Lora', serif;
      font-size: 2.2rem;
      margin: 0.75rem 0;
      color: #fff;
    }
    .article-body {
      font-family: 'Lora', serif;
      font-size: 1.1rem;
      line-height: 1.8;
      color: #e2e8f0;
    }
    .article-body h1, .article-body h2, .article-body h3 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      margin: 1.5rem 0 1rem 0;
      color: #fff;
    }
    .article-body img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1rem 0;
      display: block;
    }
    .article-body img.alignleft {
      float: left;
      margin: 0.5rem 1.5rem 1rem 0;
    }
    .article-body img.alignright {
      float: right;
      margin: 0.5rem 0 1rem 1.5rem;
    }
    .article-body img.aligncenter {
      display: block;
      margin: 1.5rem auto;
    }
    .article-body::after {
      content: "";
      display: table;
      clear: both;
    }
    .article-body p { margin-bottom: 1.25rem; }
    .article-body ul, .article-body ol { margin: 1rem 0 1.5rem 2rem; }
    .article-body blockquote {
      border-left: 4px solid var(--accent);
      padding-left: 1rem;
      margin: 1.5rem 0;
      font-style: italic;
      color: var(--text-muted);
    }
    .search-box {
      width: 100%;
      padding: 0.8rem 1.2rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #090d16;
      color: var(--text);
      font-size: 1rem;
      margin-bottom: 1.5rem;
    }
    .search-box:focus { outline: none; border-color: var(--accent); }
    footer {
      border-top: 1px solid var(--border);
      padding: 1.5rem;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 3rem;
    }
  </style>
</head>
<body>
  <header>
    <h1><a href="${rootPrefix}index.html">Revista Auta de Souza <span>Archive</span></a></h1>
    <nav>
      <a href="${rootPrefix}index.html">Artigos (${counts.posts})</a>
      <a href="${rootPrefix}pages.html">Páginas (${counts.pages})</a>
      <a href="${rootPrefix}raw.html">API Dumps</a>
    </nav>
  </header>
  <main>
    ${bodyContent}
  </main>
  <footer>
    Standalone Static Archive &bull; Zero Server Dependencies
  </footer>
  <script>
    function filterCards() {
      const q = document.getElementById('search')?.value.toLowerCase() || '';
      document.querySelectorAll('.card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? 'flex' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

async function copyDir(src, dest, filter = () => true) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (!filter(srcPath)) continue;

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, filter);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function buildStaticSite() {
  console.log('🏗️ Building 100% Static HTML Site into dist/...');
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  // Load Content Items
  const posts = await loadItemsFromDir(POSTS_DIR, 'post');
  const pages = await loadItemsFromDir(PAGES_DIR, 'page');
  const counts = { posts: posts.length, pages: pages.length };

  // 1. Build Posts Index (index.html)
  const postCards = posts.map(item => {
    let imgPath = '';
    if (item.metadata.featured_image) {
      imgPath = item.metadata.featured_image.replace(/\.\.\/\.\.\/media\//, BLOB_MEDIA_BASE);
    } else {
      const match = item.body.match(/src=["'](?:\.\.\/\.\.\/media\/|.*?\/media\/)?([^"']+)["']/);
      if (match) imgPath = `${BLOB_MEDIA_BASE}${match[1]}`;
    }

    const imgHtml = imgPath ? `<img src="${imgPath}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; margin-bottom: 0.75rem;" alt="" />` : '';

    return `
    <div class="card">
      <div>
        ${imgHtml}
        <span class="badge">${Array.isArray(item.metadata.categories) ? item.metadata.categories.join(', ') : 'Artigo'}</span>
        <h2>${item.metadata.title || item.slug}</h2>
        <div class="meta">📅 ${item.metadata.date?.split('T')[0] || ''}</div>
      </div>
      <a href="posts/${item.slug}.html" class="btn">Ler artigo &rarr;</a>
    </div>
  `;
  }).join('');

  const postsIndexHtml = renderHtmlPage('Artigos', `
    <h2>Todos os Artigos (${posts.length})</h2>
    <p style="color: var(--text-muted); margin-bottom: 1rem;">Arquivo estático de todos os artigos extraídos do site.</p>
    <input type="text" id="search" class="search-box" placeholder="Pesquisar por título ou categoria..." onkeyup="filterCards()">
    <div class="grid">${postCards}</div>
  `, './', counts);

  await fs.writeFile(path.join(DIST_DIR, 'index.html'), postsIndexHtml);

  // 2. Build Pages Index (pages.html)
  const pageCards = pages.map(item => `
    <div class="card">
      <div>
        <span class="badge">Página</span>
        <h2>${item.metadata.title || item.slug}</h2>
        <div class="meta">📅 ${item.metadata.date?.split('T')[0] || ''}</div>
      </div>
      <a href="pages/${item.slug}.html" class="btn">Ver página &rarr;</a>
    </div>
  `).join('');

  const pagesIndexHtml = renderHtmlPage('Páginas', `
    <h2>Páginas (${pages.length})</h2>
    <p style="color: var(--text-muted); margin-bottom: 1rem;">Páginas fixas do site.</p>
    <div class="grid">${pageCards}</div>
  `, './', counts);

  await fs.writeFile(path.join(DIST_DIR, 'pages.html'), pagesIndexHtml);

  // 3. Build Individual Post HTML files
  await fs.mkdir(path.join(DIST_DIR, 'posts'), { recursive: true });
  for (const item of posts) {
    const webBody = item.body.replace(/\.\.\/\.\.\/media\//g, BLOB_MEDIA_BASE);
    let htmlContent = marked.parse(webBody);

    // Strip any residual HTML img tags pointing to external non-Blob storage URLs (e.g. dead legacy portal links)
    htmlContent = htmlContent.replace(/<img[^>]*src=["'](?!https:\/\/concafrascms\.blob\.core\.windows\.net)[^"']*["'][^>]*\/?>/gi, '');

    const postPageHtml = renderHtmlPage(item.metadata.title || item.slug, `
      <a href="../index.html" style="color: var(--accent); text-decoration: none; font-weight: 500;">&larr; Voltar para Artigos</a>
      <div class="article-container" style="margin-top: 1.5rem;">
        <div class="article-header">
          <span class="badge">${Array.isArray(item.metadata.categories) ? item.metadata.categories.join(', ') : 'Artigo'}</span>
          <h1>${item.metadata.title || item.slug}</h1>
          <div style="font-size: 0.9rem; color: var(--text-muted);">
            Data: ${item.metadata.date || 'N/A'} | Status: ${item.metadata.status || 'publish'}
          </div>
        </div>
        <div class="article-body">
          ${htmlContent}
        </div>
      </div>
    `, '../', counts);

    await fs.writeFile(path.join(DIST_DIR, 'posts', `${item.slug}.html`), postPageHtml);
  }

  // 4. Build Individual Page HTML files
  await fs.mkdir(path.join(DIST_DIR, 'pages'), { recursive: true });
  for (const item of pages) {
    const webBody = item.body.replace(/\.\.\/\.\.\/media\//g, BLOB_MEDIA_BASE);
    let htmlContent = marked.parse(webBody);

    // Strip any residual HTML img tags pointing to external non-Blob storage URLs
    htmlContent = htmlContent.replace(/<img[^>]*src=["'](?!https:\/\/concafrascms\.blob\.core\.windows\.net)[^"']*["'][^>]*\/?>/gi, '');

    const pageHtml = renderHtmlPage(item.metadata.title || item.slug, `
      <a href="../pages.html" style="color: var(--accent); text-decoration: none; font-weight: 500;">&larr; Voltar para Páginas</a>
      <div class="article-container" style="margin-top: 1.5rem;">
        <div class="article-header">
          <span class="badge">Página</span>
          <h1>${item.metadata.title || item.slug}</h1>
        </div>
        <div class="article-body">
          ${htmlContent}
        </div>
      </div>
    `, '../', counts);

    await fs.writeFile(path.join(DIST_DIR, 'pages', `${item.slug}.html`), pageHtml);
  }

  // 7. Build Raw Dumps Page (raw.html)
  const rawFiles = await fs.readdir(RAW_DIR);
  const rawLinks = rawFiles.map(f => `<li><a href="raw/${f}" target="_blank" style="color: var(--accent); line-height: 2; font-family: monospace; font-size: 1.1rem;">📄 ${f}</a></li>`).join('');

  const rawHtmlPage = renderHtmlPage('Raw API Dumps', `
    <h2>Dump da API REST (JSON Bruto)</h2>
    <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Arquivos JSON brutos com todos os metadados intactos do WordPress.</p>
    <ul style="list-style: none; padding: 0;">${rawLinks}</ul>
  `, './', counts);

  await fs.writeFile(path.join(DIST_DIR, 'raw.html'), rawHtmlPage);

  console.log('\n🎉 Static Site Generation Complete!');
  console.log(`📍 Standalone static site generated in: ${DIST_DIR}`);
  console.log(`💡 You can double-click dist/index.html to open it directly in any browser, or host it on GitHub Pages, Netlify, Vercel, or S3!`);
}

buildStaticSite().catch(console.error);
