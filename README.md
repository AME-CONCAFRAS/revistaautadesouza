# Revista Auta de Souza - Extracted Content & Migration Vault

This repository contains the complete extracted content, media assets, raw JSON metadata, and standalone static HTML preview for **Revista Auta de Souza**, prepared for migration into a new website architecture (e.g. Next.js, Astro, Hugo, Gatsby, or a modern Headless CMS).

---

## 📂 Root Repository Layout

```
.
├── .github/
│   └── workflows/                # CI/CD Workflows (Azure Static Web Apps deployment)
└── extracted-site/               # Extracted WordPress content & tools
    ├── output/                   # 100% Stack-Independent Extracted Data
    │   ├── content/
    │   │   ├── pages/            # Site pages in Markdown (.md)
    │   │   └── posts/            # 260+ articles in Markdown (.md)
    │   ├── media/                # 700+ downloaded original media assets
    │   └── raw/                  # Raw WP REST API JSON Dumps (posts, pages, media, tags, categories)
    ├── dist/                     # Pre-rendered 100% static HTML website bundle
    ├── src/                      # Extractor & Static Site Generator scripts
    ├── .env.example              # Credentials configuration template
    ├── package.json              # Extractor & build dependencies
    └── README.md                 # Extractor tool documentation
```

---

## 🛠️ Guide for Future Engineers: Building the New Website

If you are tasked with building a new version of **Revista Auta de Souza**, everything you need is already extracted, cleaned, and structured locally inside `extracted-site/output/`.

### 1. Primary Migration Source (`extracted-site/output/content/`)
All pages and posts have been extracted into standard **Markdown files with YAML front-matter**.

#### YAML Front-Matter Schema:
```yaml
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
```

- **Slugs & Permalinks:** Use `slug` and `date` / `original_url` to set up clean URLs or maintain 301 redirect mappings.
- **Images:** Image URLs inside the Markdown body are normalized to relative local paths (`../../media/...`).
- **Layout Formatting:** Inline images preserve HTML alignment classes (`class="alignleft"`, `class="alignright"`, `class="aligncenter"`) and explicit dimensions (`width`, `height`).

---

### 2. Media Assets (`extracted-site/output/media/`)
- Contains **100% of uploaded images, PDFs, audio, and documents** from the WordPress site.
- Preserves original upload pathing (`YYYY/MM/filename.ext`).
- **No external server dependencies:** If the original WordPress server goes offline, all assets are permanently backed up here.

---

### 3. Raw REST API JSON Dumps (`extracted-site/output/raw/`)
If you require raw data, original WP database IDs, comment counts, or custom metadata that isn't in the Markdown files:
- `posts.json` - Complete raw REST API payload for all posts.
- `pages.json` - Complete raw REST API payload for all pages.
- `media.json` - Full media catalog metadata.
- `categories.json` & `tags.json` - Complete taxonomy mappings.

---

### 4. How to Consume This Data in Modern Frameworks

#### Example: Astro Content Collections
Copy `extracted-site/output/content/posts` into `src/content/posts` and reference in Astro:
```astro
---
import { getCollection } from 'astro:content';
const posts = await getCollection('posts');
---
{posts.map(post => (
  <article>
    <h2>{post.data.title}</h2>
    <p>{post.data.date}</p>
  </article>
))}
```

#### Example: Next.js (App Router)
Read files using `gray-matter` and `remark`:
```typescript
import fs from 'fs';
import matter from 'gray-matter';

export async function getPost(slug: string) {
  const fileContent = fs.readFileSync(`./extracted-site/output/content/posts/${slug}.md`, 'utf-8');
  return matter(fileContent);
}
```

---

## 🚀 Temporary Deployment Note (Azure Static Web Apps)

The GitHub Action workflow (`.github/workflows/azure-static-web-apps-calm-ocean-0b23ed410.yml`) is currently configured to deploy `extracted-site/dist` so the static archive is accessible online.

> 📌 **Action Required for Future Developers:**  
> Once the new site build is completed, revert the `output_location` parameter in the Azure workflow file back to your new framework's build output directory. See **[Issue #2: Revert Azure Static Web Apps workflow output location after new site migration](https://github.com/AME-CONCAFRAS/revistaautadesouza/issues/2)** for details.
