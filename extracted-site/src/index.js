import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import TurndownService from 'turndown';

const WP_BASE = process.env.WP_URL || 'https://www.revistaautadesouza.com';
const WP_API = `${WP_BASE}/index.php/wp-json/wp/v2`;
const WP_USER = process.env.WP_ADMIN_USER;
const WP_PASS = process.env.WP_ADMIN_PASS;

const OUTPUT_DIR = path.resolve('./extracted-site/output');
const CONTENT_DIR = path.join(OUTPUT_DIR, 'content');
const PAGES_DIR = path.join(CONTENT_DIR, 'pages');
const POSTS_DIR = path.join(CONTENT_DIR, 'posts');
const MEDIA_DIR = path.join(OUTPUT_DIR, 'media');
const RAW_DIR = path.join(OUTPUT_DIR, 'raw');

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Preserve IFRAME embedded videos (YouTube, Vimeo, etc.) in Markdown output
turndown.addRule('preserveIframes', {
  filter: ['iframe'],
  replacement: (content, node) => {
    const src = node.getAttribute('src') || '';
    const title = node.getAttribute('title') || '';
    const width = node.getAttribute('width') || '100%';
    const height = node.getAttribute('height') || '400';
    if (!src) return '';
    return `\n\n<iframe src="${src}" title="${title}" width="${width}" height="${height}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="max-width: 100%; border-radius: 8px; margin: 1rem 0;"></iframe>\n\n`;
  }
});

// Preserve HTML figure/img alignment classes and dimensions in Markdown output
turndown.addRule('preserveImagesWithAlignment', {
  filter: (node) => {
    return node.nodeName === 'FIGURE' || (node.nodeName === 'IMG' && (node.getAttribute('width') || node.className));
  },
  replacement: (content, node) => {
    const img = node.nodeName === 'IMG' ? node : node.querySelector('img');
    if (!img) return content;

    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const width = img.getAttribute('width');
    const height = img.getAttribute('height');

    // Extract alignment from figure or img class
    let align = '';
    const parentClass = node.className || '';
    const imgClass = img.className || '';
    const combinedClass = `${parentClass} ${imgClass}`;

    if (combinedClass.includes('alignleft')) align = 'alignleft';
    else if (combinedClass.includes('alignright')) align = 'alignright';
    else if (combinedClass.includes('aligncenter')) align = 'aligncenter';

    let attrs = `src="${src}" alt="${alt}"`;
    if (align) attrs += ` class="${align}"`;
    if (width) attrs += ` width="${width}"`;
    if (height) attrs += ` height="${height}"`;

    return `\n\n<img ${attrs} />\n\n`;
  }
});

// Configure headers
const headers = {};
if (WP_USER && WP_PASS) {
  headers['Authorization'] = 'Basic ' + Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
}

async function ensureDirs() {
  await fs.mkdir(PAGES_DIR, { recursive: true });
  await fs.mkdir(POSTS_DIR, { recursive: true });
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.mkdir(RAW_DIR, { recursive: true });
}

async function fetchAllItems(endpoint) {
  let page = 1;
  let allItems = [];
  while (true) {
    console.log(`  Fetching ${endpoint} (page ${page})...`);
    const url = `${WP_API}/${endpoint}?per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 400 || res.status === 404) break; // Out of pages
      console.warn(`  ⚠️ Warning fetching ${endpoint} page ${page}: ${res.status} ${res.statusText}`);
      break;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    allItems.push(...data);
    page++;
  }
  return allItems;
}

function cleanHtml(html) {
  if (!html) return '';
  // Remove WP block comments
  let cleaned = html.replace(/<!-- \/?wp:[^>]+ -->/g, '');
  return cleaned;
}

function generateFrontMatter(item, type, categoriesMap = {}, tagsMap = {}, mediaMap = {}, fileMap = new Map()) {
  const title = item.title?.rendered ? item.title.rendered.replace(/"/g, '\\"') : '';
  const date = item.date || '';
  const modified = item.modified || '';
  const slug = item.slug || '';
  const status = item.status || 'publish';
  const link = item.link || '';

  let cats = [];
  if (item.categories) {
    cats = item.categories.map(id => categoriesMap[id] || id);
  }

  let tags = [];
  if (item.tags) {
    tags = item.tags.map(id => tagsMap[id] || id);
  }

  // Resolve Featured Image URL / local path
  let featuredImage = '';
  if (item.featured_media && mediaMap[item.featured_media]) {
    const rawMediaUrl = mediaMap[item.featured_media];
    const filename = path.basename(rawMediaUrl.split('?')[0]);
    const localRel = fileMap.get(filename.toLowerCase());
    if (localRel) {
      featuredImage = `../../media/${localRel.replace(/\\/g, '/')}`;
    }
  }

  return `---
title: "${title}"
slug: "${slug}"
date: "${date}"
modified: "${modified}"
status: "${status}"
type: "${type}"
featured_image: "${featuredImage}"
original_url: "${link}"
categories: ${JSON.stringify(cats)}
tags: ${JSON.stringify(tags)}
---

`;
}

async function runExtraction() {
  console.log('🚀 Starting WordPress Content Extraction...');
  await ensureDirs();

  // 1. Fetch Taxonomies
  console.log('📦 Fetching Categories and Tags...');
  const categories = await fetchAllItems('categories');
  const tags = await fetchAllItems('tags');

  const categoriesMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const tagsMap = Object.fromEntries(tags.map(t => [t.id, t.name]));

  await fs.writeFile(path.join(RAW_DIR, 'categories.json'), JSON.stringify(categories, null, 2));
  await fs.writeFile(path.join(RAW_DIR, 'tags.json'), JSON.stringify(tags, null, 2));

  // 4. Fetch Media catalog
  console.log('🖼️ Fetching Media catalog...');
  const media = await fetchAllItems('media');
  await fs.writeFile(path.join(RAW_DIR, 'media.json'), JSON.stringify(media, null, 2));
  console.log(`  Saved ${media.length} media asset metadata records.`);

  const mediaMap = Object.fromEntries(media.map(m => [m.id, m.source_url]));
  const fileMap = new Map();
  async function buildFileMap(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) await buildFileMap(fullPath);
        else fileMap.set(entry.name.toLowerCase(), fullPath.replace(MEDIA_DIR, '').replace(/^[/\\]/, ''));
      }
    } catch {}
  }
  await buildFileMap(MEDIA_DIR);

  // 2. Fetch Pages
  console.log('📄 Fetching Pages...');
  const pages = await fetchAllItems('pages');
  await fs.writeFile(path.join(RAW_DIR, 'pages.json'), JSON.stringify(pages, null, 2));
  console.log(`  Saved ${pages.length} raw pages to JSON.`);

  for (const pageItem of pages) {
    const rawContent = cleanHtml(pageItem.content?.rendered || '');
    const markdownContent = turndown.turndown(rawContent);
    const frontMatter = generateFrontMatter(pageItem, 'page', categoriesMap, tagsMap, mediaMap, fileMap);
    const filename = `${pageItem.slug || pageItem.id}.md`;
    await fs.writeFile(path.join(PAGES_DIR, filename), frontMatter + markdownContent);
  }
  console.log(`  ✅ Written ${pages.length} page Markdown files.`);

  // 3. Fetch Posts
  console.log('✍️ Fetching Posts...');
  const posts = await fetchAllItems('posts');
  await fs.writeFile(path.join(RAW_DIR, 'posts.json'), JSON.stringify(posts, null, 2));
  console.log(`  Saved ${posts.length} raw posts to JSON.`);

  for (const postItem of posts) {
    const rawContent = cleanHtml(postItem.content?.rendered || '');
    const markdownContent = turndown.turndown(rawContent);
    const frontMatter = generateFrontMatter(postItem, 'post', categoriesMap, tagsMap, mediaMap, fileMap);
    const filename = `${postItem.slug || postItem.id}.md`;
    await fs.writeFile(path.join(POSTS_DIR, filename), frontMatter + markdownContent);
  }
  console.log(`  ✅ Written ${posts.length} post Markdown files.`);

  console.log('\n🎉 Content Extraction Complete!');
  console.log(`📍 Output saved in: ${OUTPUT_DIR}`);
}

runExtraction().catch(err => {
  console.error('❌ Extraction failed:', err);
});
