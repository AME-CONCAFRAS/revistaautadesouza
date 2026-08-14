# Revista Auta de Souza - WordPress Content Extractor & Backup

This project provides tools to crawl, extract, clean, and back up all content (pages, posts, media assets, and raw JSON metadata) from WordPress via REST API into structured Markdown files with YAML front-matter, as well as a standalone 100% static HTML preview builder.

---

## 📁 Repository Structure

```
├── .env.example          # Environment variables template
├── src/
│   ├── test-connection.js# Test WP REST API connection & authentication
│   ├── index.js          # Main content extractor (Pages, Posts, Taxonomies, Media JSON)
│   ├── download-media.js # Downloader for all 700+ media assets locally
│   ├── fix-image-links.js# Normalizes WP image URLs to local relative media paths
│   └── build-static.js   # 100% static HTML site generator (outputs to dist/)
├── output/               # Extracted Markdown, Media, and Raw JSON Dumps (tracked in Git)
│   ├── content/
│   │   ├── pages/        # Extracted pages as Markdown (.md)
│   │   └── posts/        # Extracted posts/articles as Markdown (.md)
│   ├── media/            # All downloaded images & media assets
│   └── raw/              # Raw WP REST API JSON dumps (pages, posts, categories, tags, media)
└── dist/                 # 100% static HTML website bundle (generated via npm run build-static)
```

---

## ⚡ Quick Start

### 1. Configure Credentials
Copy `.env.example` to `.env`:
```env
WP_URL=https://www.revistaautadesouza.com
WP_ADMIN_USER=your-email@example.com
WP_ADMIN_PASS=your-password
```

### 2. Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run test-connection` | Verifies WP REST API connectivity & auth. |
| `npm run extract` | Crawls WordPress API and extracts all pages, posts, categories, and media catalog. |
| `node src/download-media.js` | Downloads all 700+ media assets locally into `output/media/`. |
| `node src/fix-image-links.js` | Normalizes image links, width/height dimensions, and alignment classes. |
| `npm run build-static` | Generates 100% standalone static HTML website into `dist/`. |

---

## 📄 Target Content Format

All extracted content is saved in `output/content/` as **Markdown with YAML front-matter**:

```markdown
---
title: "MEDIUNIDADE"
slug: "mediunidade"
date: "2021-11-06T10:48:52"
modified: "2021-11-06T10:48:52"
status: "publish"
type: "post"
featured_image: "../../media/2021/11/chico.jpg"
original_url: "https://www.revistaautadesouza.com/index.php/2021/11/06/mediunidade/"
categories: ["Conheça o Espiritismo"]
tags: ["destaque"]
---

<img src="../../media/2021/11/psicografia_.jpg" alt="" class="alignleft" width="600" height="299" />

## Segundo Jesus
"Aos que crerem acompanharão estes milagres..."
```