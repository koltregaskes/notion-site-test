// scripts/fetch-notion.mjs
import fs from "node:fs/promises";
import path from "node:path";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.error("Missing NOTION_TOKEN or NOTION_DATABASE_ID env vars.");
  process.exit(1);
}

const notionFetch = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Notion API error ${res.status}: ${text}`);
  }
  return res.json();
};

const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";

const getProp = (page, name) => page?.properties?.[name];

const getTitle = (page) => {
  const p = getProp(page, "Name");
  const title = p?.title?.map(t => t.plain_text).join("") || "";
  return title || "Untitled";
};

const getSelect = (page, name) => getProp(page, name)?.select?.name || "";
const getCheckbox = (page, name) => !!getProp(page, name)?.checkbox;
const getRichText = (page, name) =>
  (getProp(page, name)?.rich_text || []).map(t => t.plain_text).join("");
const getMultiSelect = (page, name) =>
  (getProp(page, name)?.multi_select || []).map(t => t.name);

async function queryDatabaseAll() {
  const out = [];
  let cursor = undefined;

  while (true) {
    const body = {
      page_size: 100,
      filter: {
        property: "Publish",
        checkbox: { equals: true },
      },
      ...(cursor ? { start_cursor: cursor } : {}),
    };

    const data = await notionFetch(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      { method: "POST", body: JSON.stringify(body) }
    );

    out.push(...(data.results || []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }

  return out;
}

async function fetchBlocksAll(blockId) {
  const blocks = [];
  let cursor = undefined;

  while (true) {
    const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);

    const data = await notionFetch(url.toString(), { method: "GET" });

    blocks.push(...(data.results || []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }

  return blocks;
}

const rtToHtml = (rtArr = []) =>
  rtArr.map(t => {
    const text = escapeHtml(t.plain_text || "");
    // very minimal formatting
    if (t.annotations?.code) return `<code>${text}</code>`;
    if (t.annotations?.bold) return `<strong>${text}</strong>`;
    if (t.annotations?.italic) return `<em>${text}</em>`;
    return text;
  }).join("");

function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function blockToHtml(block) {
  const t = block.type;

  if (t === "paragraph") {
    const html = rtToHtml(block.paragraph?.rich_text || []);
    return html ? `<p>${html}</p>` : "";
  }

  if (t === "heading_1") return `<h2 id="${slugify(rtToHtml(block.heading_1?.rich_text || []))}">${rtToHtml(block.heading_1?.rich_text || [])}</h2>`;
  if (t === "heading_2") return `<h3 id="${slugify(rtToHtml(block.heading_2?.rich_text || []))}">${rtToHtml(block.heading_2?.rich_text || [])}</h3>`;
  if (t === "heading_3") return `<h4 id="${slugify(rtToHtml(block.heading_3?.rich_text || []))}">${rtToHtml(block.heading_3?.rich_text || [])}</h4>`;

  if (t === "quote") {
    const html = rtToHtml(block.quote?.rich_text || []);
    return html ? `<blockquote>${html}</blockquote>` : "";
  }

  if (t === "divider") return `<hr />`;

  if (t === "bulleted_list_item") {
    const html = rtToHtml(block.bulleted_list_item?.rich_text || []);
    return html ? `<li>${html}</li>` : "";
  }

  if (t === "numbered_list_item") {
    const html = rtToHtml(block.numbered_list_item?.rich_text || []);
    return html ? `<li>${html}</li>` : "";
  }

  if (t === "code") {
    const code = rtToHtml(block.code?.rich_text || []);
    const lang = escapeHtml(block.code?.language || "");
    return `<pre><code data-lang="${lang}">${code}</code></pre>`;
  }

  if (t === "image") {
    const src = block.image?.file?.url || block.image?.external?.url || "";
    const cap = rtToHtml(block.image?.caption || []);
    if (!src) return "";
    return `<figure><img src="${escapeHtml(src)}" alt="" loading="lazy" />${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
  }

  if (t === "table") {
    // Tables in Notion have rows which are stored as children blocks
    // We'll need to handle this separately when we fetch children
    return ""; // Will be handled in blocksToHtml when processing children
  }

  if (t === "table_row") {
    const cells = block.table_row?.cells || [];
    const cellsHtml = cells.map(cell => {
      const content = rtToHtml(cell);
      return `<td>${content}</td>`;
    }).join("");
    return `<tr>${cellsHtml}</tr>`;
  }

  return "";
}

function blocksToHtml(blocks) {
  let html = "";
  let inBullets = false;
  let inNumbers = false;
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    if (b.type === "table") {
      if (inBullets) { html += `</ul>`; inBullets = false; }
      if (inNumbers) { html += `</ol>`; inNumbers = false; }

      // Collect table row children
      inTable = true;
      tableRows = [];

      // Get table rows from children
      if (b.has_children && b.table_row_children) {
        tableRows = b.table_row_children;
      }

      // Start table
      const hasHeader = b.table?.has_column_header || false;
      html += `<table>`;

      // Add rows
      tableRows.forEach((row, idx) => {
        if (idx === 0 && hasHeader) {
          html += `<thead><tr>`;
          const cells = row.table_row?.cells || [];
          cells.forEach(cell => {
            const content = rtToHtml(cell);
            html += `<th>${content}</th>`;
          });
          html += `</tr></thead><tbody>`;
        } else {
          if (idx === 0) html += `<tbody>`;
          html += `<tr>`;
          const cells = row.table_row?.cells || [];
          cells.forEach(cell => {
            const content = rtToHtml(cell);
            html += `<td>${content}</td>`;
          });
          html += `</tr>`;
        }
      });

      html += `</tbody></table>`;
      inTable = false;
      continue;
    }

    if (b.type === "table_row") {
      // Skip standalone table rows (they should be handled as part of table)
      continue;
    }

    if (b.type === "bulleted_list_item") {
      if (inNumbers) { html += `</ol>`; inNumbers = false; }
      if (!inBullets) { html += `<ul>`; inBullets = true; }
      html += blockToHtml(b);
      continue;
    }
    if (b.type === "numbered_list_item") {
      if (inBullets) { html += `</ul>`; inBullets = false; }
      if (!inNumbers) { html += `<ol>`; inNumbers = true; }
      html += blockToHtml(b);
      continue;
    }

    if (inBullets) { html += `</ul>`; inBullets = false; }
    if (inNumbers) { html += `</ol>`; inNumbers = false; }

    html += blockToHtml(b);
  }

  if (inBullets) html += `</ul>`;
  if (inNumbers) html += `</ol>`;
  return html;
}

function extractHeadings(blocks) {
  const headings = [];
  
  for (const b of blocks) {
    if (b.type === "heading_1" || b.type === "heading_2" || b.type === "heading_3") {
      const text = rtToHtml(b[b.type]?.rich_text || []);
      const level = b.type === "heading_1" ? 2 : b.type === "heading_2" ? 3 : 4;
      headings.push({
        text,
        id: slugify(text),
        level
      });
    }
  }
  
  return headings;
}

function generateTOC(headings) {
  if (headings.length === 0) return "";

  return `
    <nav class="toc">
      <h4>Contents</h4>
      <ul>
        ${headings.map(h => `<li class="toc-${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join("")}
      </ul>
    </nav>
  `;
}

function getHeaderFooter(basePath = "./", activePage = "") {
  const header = `<header class="site-header">
    <div class="header-content">
      <a href="${basePath}" class="site-logo">
        <span class="logo-icon">K</span>
        <span class="logo-text">Kol's Korner</span>
      </a>
      <nav class="site-nav">
        <a href="${basePath}posts/"${activePage === 'posts' ? ' class="active"' : ''}>Posts</a>
        <a href="${basePath}tags/"${activePage === 'tags' ? ' class="active"' : ''}>Tags</a>
        <a href="${basePath}images/"${activePage === 'images' ? ' class="active"' : ''}>Images</a>
        <a href="${basePath}videos/"${activePage === 'videos' ? ' class="active"' : ''}>Videos</a>
        <a href="${basePath}about/"${activePage === 'about' ? ' class="active"' : ''}>About</a>
        <a href="${basePath}subscribe/"${activePage === 'subscribe' ? ' class="active"' : ''}>Subscribe</a>
        <button class="theme-toggle" aria-label="Toggle theme">
          <svg class="sun-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="16" x2="10" y2="18" stroke="currentColor" stroke-width="2"/>
            <line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" stroke-width="2"/>
            <line x1="16" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="2"/>
          </svg>
          <svg class="moon-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M17 10.5C16 14.5 12 18 8 18C4 18 2 14.5 2 10.5C2 6.5 4 3 8 3C8.5 3 9 3.1 9.5 3.2C7.5 4.5 6.5 6.5 6.5 9C6.5 12.5 9 15 12.5 15C14.5 15 16.5 14 17.8 12C17.3 11.5 17 11 17 10.5Z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </nav>
    </div>
  </header>`;

  const footer = `<footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2025 All rights reserved.</p>
      <p class="footer-credit">Made in the UK by Kol Tregaskes. Design inspired by <a href="https://justoffbyone.com" target="_blank" rel="noopener">Off by One</a>.</p>
    </div>
    <div class="footer-social">
      <a href="https://twitter.com/koltregaskes" aria-label="Twitter" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </a>
      <a href="https://instagram.com/koltregaskes" aria-label="Instagram" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
        </svg>
      </a>
      <a href="https://youtube.com/@koltregaskes" aria-label="YouTube" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      </a>
      <a href="https://justoffbyone.com" aria-label="Website" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </a>
    </div>
  </footer>`;

  const script = `<script>
    const themeToggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;
    themeToggle.addEventListener('click', () => {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
  </script>`;

  return { header, footer, script };
}

async function writeArticlePage({ title, slug, contentHtml, tags, date, headings }) {
  const outDir = path.join("site", "posts", slug);
  await fs.mkdir(outDir, { recursive: true });

  const toc = generateTOC(headings);
  const tagsHtml = tags.length ? `<div class="post-tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : "";

  // Calculate reading time (rough estimate: 200 words per minute)
  const wordCount = contentHtml.split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/notion-site-test/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="header-content">
      <a href="/notion-site-test/" class="site-logo">
        <span class="logo-icon">K</span>
        <span class="logo-text">Kol's Korner</span>
      </a>
      <nav class="site-nav">
        <a href="/notion-site-test/posts/">Posts</a>
        <a href="/notion-site-test/tags/">Tags</a>
        <a href="/notion-site-test/images/">Images</a>
        <a href="/notion-site-test/videos/">Videos</a>
        <a href="/notion-site-test/about/">About</a>
        <a href="/notion-site-test/subscribe/">Subscribe</a>
        <button class="theme-toggle" aria-label="Toggle theme">
          <svg class="sun-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="16" x2="10" y2="18" stroke="currentColor" stroke-width="2"/>
            <line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" stroke-width="2"/>
            <line x1="16" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="2"/>
          </svg>
          <svg class="moon-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M17 10.5C16 14.5 12 18 8 18C4 18 2 14.5 2 10.5C2 6.5 4 3 8 3C8.5 3 9 3.1 9.5 3.2C7.5 4.5 6.5 6.5 6.5 9C6.5 12.5 9 15 12.5 15C14.5 15 16.5 14 17.8 12C17.3 11.5 17 11 17 10.5Z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </nav>
    </div>
  </header>

  <div class="page-container">
    ${toc ? `<aside class="sidebar">
      <div class="toc-wrapper">
        ${toc}
      </div>
    </aside>` : ""}

    <main class="post-main">
      <article class="post">
        <header class="post-header">
          <h1 class="post-title">${escapeHtml(title)}</h1>
          <div class="post-meta">
            <span class="post-author">Kol Tregaskes</span>
            <span class="meta-sep">•</span>
            <time class="post-date">${date ? new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}</time>
            <span class="meta-sep">•</span>
            <span class="reading-time">${readingTime} min read</span>
          </div>
          ${tagsHtml}
        </header>
        <div class="post-content">
          ${contentHtml}
        </div>
      </article>
    </main>
  </div>

  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2025 All rights reserved.</p>
      <p class="footer-credit">Made in the UK by Kol Tregaskes. Design inspired by <a href="https://justoffbyone.com" target="_blank" rel="noopener">Off by One</a>.</p>
    </div>
    <div class="footer-social">
      <a href="https://twitter.com/koltregaskes" aria-label="Twitter" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </a>
      <a href="https://instagram.com/koltregaskes" aria-label="Instagram" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
        </svg>
      </a>
      <a href="https://youtube.com/@koltregaskes" aria-label="YouTube" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      </a>
      <a href="https://koltregaskes.com" aria-label="Website" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </a>
    </div>
  </footer>

  <script>
    // Theme toggle
    const themeToggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;

    themeToggle.addEventListener('click', () => {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);

    // TOC highlight on scroll
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = entry.target.getAttribute('id');
        const tocLink = document.querySelector(\`.toc a[href="#\${id}"]\`);
        if (tocLink) {
          if (entry.isIntersecting) {
            document.querySelectorAll('.toc a').forEach(l => l.classList.remove('active'));
            tocLink.classList.add('active');
          }
        }
      });
    }, { rootMargin: '-20% 0px -35% 0px' });

    document.querySelectorAll('h2[id], h3[id], h4[id]').forEach(heading => {
      observer.observe(heading);
    });
  </script>
</body>
</html>`;

  await fs.writeFile(path.join(outDir, "index.html"), html, "utf8");
  return `/posts/${slug}/`;
}

async function writeHomePage(items) {
  const articles = items.filter(i => i.kind === "article");

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kol's Korner</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="header-content">
      <a href="./" class="site-logo">
        <span class="logo-icon">K</span>
        <span class="logo-text">Kol's Korner</span>
      </a>
      <nav class="site-nav">
        <a href="./posts/">Posts</a>
        <a href="./tags/">Tags</a>
        <a href="./images/">Images</a>
        <a href="./videos/">Videos</a>
        <a href="./about/">About</a>
        <a href="./subscribe/">Subscribe</a>
        <button class="theme-toggle" aria-label="Toggle theme">
          <svg class="sun-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="16" x2="10" y2="18" stroke="currentColor" stroke-width="2"/>
            <line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" stroke-width="2"/>
            <line x1="16" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="2"/>
          </svg>
          <svg class="moon-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M17 10.5C16 14.5 12 18 8 18C4 18 2 14.5 2 10.5C2 6.5 4 3 8 3C8.5 3 9 3.1 9.5 3.2C7.5 4.5 6.5 6.5 6.5 9C6.5 12.5 9 15 12.5 15C14.5 15 16.5 14 17.8 12C17.3 11.5 17 11 17 10.5Z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </nav>
    </div>
  </header>

  <main class="home-main">
    <div class="home-intro">
      <img src="https://via.placeholder.com/120x120?text=KT" alt="Kol Tregaskes" class="intro-avatar" />
      <h1 class="intro-title">Kol's Korner</h1>
      <p class="intro-text">Hi. My name is Kol Tregaskes. I'm a software developer and tech enthusiast based in the UK.</p>
      <p class="intro-text">Here I write about tech, software development, and other topics that interest me.</p>
      <p class="intro-start">Start here:</p>
      <ul class="intro-list">
        <li><a href="#">Measuring Engineering Productivity</a></li>
        <li><a href="#">Jokes. You invented bad jokes.</a></li>
      </ul>
    </div>

    <section class="latest-section">
      <h2 class="section-title">Latest posts</h2>
      <div class="posts-list">
        ${articles.map(item => {
          const readingTime = Math.max(1, Math.ceil((item.summary || "").split(/\s+/).length / 200));
          return `
            <article class="post-item">
              <a href="./posts/${item.slug}/" class="post-link">
                <h3 class="post-item-title">${escapeHtml(item.title)}</h3>
                <p class="post-item-summary">${escapeHtml(item.summary || "")}</p>
                <div class="post-item-meta">
                  <time>${new Date(item.updatedTime).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
                  <span class="meta-sep">•</span>
                  <span>${readingTime} min read</span>
                </div>
              </a>
            </article>
          `;
        }).join("")}
      </div>
      <div class="see-all">
        <a href="./posts/" class="see-all-link">See all posts →</a>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2025 All rights reserved.</p>
      <p class="footer-credit">Made in the UK by Kol Tregaskes. Design inspired by <a href="https://justoffbyone.com" target="_blank" rel="noopener">Off by One</a>.</p>
    </div>
    <div class="footer-social">
      <a href="https://twitter.com/koltregaskes" aria-label="Twitter" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </a>
      <a href="https://instagram.com/koltregaskes" aria-label="Instagram" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
        </svg>
      </a>
      <a href="https://youtube.com/@koltregaskes" aria-label="YouTube" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      </a>
      <a href="https://koltregaskes.com" aria-label="Website" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </a>
    </div>
  </footer>

  <script>
    // Theme toggle
    const themeToggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;

    themeToggle.addEventListener('click', () => {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
  </script>
</body>
</html>`;

  await fs.writeFile("site/index.html", html, "utf8");
}

async function writePostsPage(items) {
  const articles = items.filter(i => i.kind === "article");

  await fs.mkdir("site/posts", { recursive: true });

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Posts - Kol's Korner</title>
  <link rel="stylesheet" href="../styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="header-content">
      <a href="../" class="site-logo">
        <span class="logo-icon">K</span>
        <span class="logo-text">Kol's Korner</span>
      </a>
      <nav class="site-nav">
        <a href="./" class="active">Posts</a>
        <a href="../tags/">Tags</a>
        <a href="../images/">Images</a>
        <a href="../videos/">Videos</a>
        <a href="../about/">About</a>
        <a href="../subscribe/">Subscribe</a>
        <button class="theme-toggle" aria-label="Toggle theme">
          <svg class="sun-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="16" x2="10" y2="18" stroke="currentColor" stroke-width="2"/>
            <line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" stroke-width="2"/>
            <line x1="16" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="2"/>
          </svg>
          <svg class="moon-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M17 10.5C16 14.5 12 18 8 18C4 18 2 14.5 2 10.5C2 6.5 4 3 8 3C8.5 3 9 3.1 9.5 3.2C7.5 4.5 6.5 6.5 6.5 9C6.5 12.5 9 15 12.5 15C14.5 15 16.5 14 17.8 12C17.3 11.5 17 11 17 10.5Z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </nav>
    </div>
  </header>

  <main class="content-main">
    <h1 class="page-title">Posts</h1>

    <div class="posts-list">
      ${articles.map(item => {
        const readingTime = Math.max(1, Math.ceil((item.summary || "").split(/\s+/).length / 200));
        return `
          <article class="post-item">
            <a href="../posts/${item.slug}/" class="post-link">
              <h3 class="post-item-title">${escapeHtml(item.title)}</h3>
              <p class="post-item-summary">${escapeHtml(item.summary || "")}</p>
              <div class="post-item-meta">
                <time>${new Date(item.updatedTime).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
                <span class="meta-sep">•</span>
                <span>${readingTime} min read</span>
              </div>
            </a>
          </article>
        `;
      }).join("")}
    </div>
  </main>

  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2025 All rights reserved.</p>
      <p class="footer-credit">Made in the UK by Kol Tregaskes. Design inspired by <a href="https://justoffbyone.com" target="_blank" rel="noopener">Off by One</a>.</p>
    </div>
    <div class="footer-social">
      <a href="https://twitter.com/koltregaskes" aria-label="Twitter" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </a>
      <a href="https://instagram.com/koltregaskes" aria-label="Instagram" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
        </svg>
      </a>
      <a href="https://youtube.com/@koltregaskes" aria-label="YouTube" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      </a>
      <a href="https://koltregaskes.com" aria-label="Website" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </a>
    </div>
  </footer>

  <script>
    const themeToggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;
    themeToggle.addEventListener('click', () => {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
  </script>
</body>
</html>`;

  await fs.writeFile("site/posts/index.html", html, "utf8");
}

async function writeTagsPage(items) {
  const tagCounts = {};
  items.filter(i => i.kind === "article").forEach(item => {
    item.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  await fs.mkdir("site/tags", { recursive: true });

  const headerFooter = getHeaderFooter("../", "tags");

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tags - Kol's Korner</title>
  <link rel="stylesheet" href="../styles.css" />
</head>
<body>
  ${headerFooter.header}

  <main class="content-main">
    <h1 class="page-title">Tags</h1>

    ${sortedTags.map(([tag, count]) => {
      const tagPosts = items.filter(i => i.kind === "article" && i.tags.includes(tag));
      return `
        <section class="tag-group">
          <h2 class="tag-group-title">
            <span class="hash">#</span>${escapeHtml(tag)} <span class="tag-group-count">(${count})</span>
          </h2>
          <div class="posts-list">
            ${tagPosts.map(item => {
              const readingTime = Math.max(1, Math.ceil((item.summary || "").split(/\s+/).length / 200));
              return `
                <article class="post-item">
                  <a href="../posts/${item.slug}/" class="post-link">
                    <h3 class="post-item-title">${escapeHtml(item.title)}</h3>
                    <p class="post-item-summary">${escapeHtml(item.summary || "")}</p>
                    <div class="post-item-meta">
                      <time>${new Date(item.updatedTime).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
                      <span class="meta-sep">•</span>
                      <span>${readingTime} min read</span>
                    </div>
                  </a>
                </article>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }).join("")}
  </main>

  ${headerFooter.footer}
  ${headerFooter.script}
</body>
</html>`;

  await fs.writeFile("site/tags/index.html", html, "utf8");
}

async function writeAboutPage() {
  await fs.mkdir("site/about", { recursive: true });

  const headerFooter = getHeaderFooter("../", "about");

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>About - Kol's Korner</title>
  <link rel="stylesheet" href="../styles.css" />
</head>
<body>
  ${headerFooter.header}

  <main class="content-main">
    <article class="about-content">
      <h1 class="page-title">About</h1>
      <div class="about-body">
        <p>Hi. My name is Kol Tregaskes. I'm a software developer and tech enthusiast based in the UK.</p>
        <p>This blog is about tech, software development, and other topics that interest me.</p>
        <p>You can find me on <a href="https://twitter.com/koltregaskes" target="_blank">Twitter</a>, <a href="https://instagram.com/koltregaskes" target="_blank">Instagram</a>, and <a href="https://youtube.com/@koltregaskes" target="_blank">YouTube</a>.</p>
      </div>
    </article>
  </main>

  ${headerFooter.footer}
  ${headerFooter.script}
</body>
</html>`;

  await fs.writeFile("site/about/index.html", html, "utf8");
}

async function writeSubscribePage() {
  await fs.mkdir("site/subscribe", { recursive: true });

  const headerFooter = getHeaderFooter("../", "subscribe");

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Subscribe - Kol's Korner</title>
  <link rel="stylesheet" href="../styles.css" />
</head>
<body>
  ${headerFooter.header}

  <main class="content-main">
    <div class="subscribe-content">
      <h1 class="page-title">Subscribe</h1>
      <p class="subscribe-text">Subscribe to get notified when new posts are published.</p>
      <form class="subscribe-form" action="#" method="post">
        <input type="email" placeholder="your@email.com" required class="subscribe-input" />
        <button type="submit" class="subscribe-button">Subscribe</button>
      </form>
      <p class="subscribe-note">No spam, unsubscribe at any time.</p>
    </div>
  </main>

  ${headerFooter.footer}
  ${headerFooter.script}
</body>
</html>`;

  await fs.writeFile("site/subscribe/index.html", html, "utf8");
}

async function writeGalleryPage(items, kind) {
  const kindItems = items.filter(i => i.kind === kind);
  const kindName = kind.charAt(0).toUpperCase() + kind.slice(1) + "s";

  await fs.mkdir(`site/${kind}s`, { recursive: true });

  const headerFooter = getHeaderFooter("../", `${kind}s`);

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${kindName} - Kol's Korner</title>
  <link rel="stylesheet" href="../styles.css" />
</head>
<body>
  ${headerFooter.header}

  <main class="content-main">
    <h1 class="page-title">${kindName}</h1>

    <div class="gallery-grid">
      ${kindItems.map(item => `
        <article class="gallery-item">
          ${item.driveUrl ? `
            <a href="${escapeHtml(item.driveUrl)}" target="_blank" rel="noopener" class="gallery-link">
              <div class="gallery-placeholder">
                <span class="gallery-icon">${kind === 'image' ? '🖼️' : '🎥'}</span>
              </div>
              <h3 class="gallery-title">${escapeHtml(item.title)}</h3>
              ${item.summary ? `<p class="gallery-summary">${escapeHtml(item.summary)}</p>` : ""}
            </a>
          ` : `
            <div class="gallery-link">
              <div class="gallery-placeholder">
                <span class="gallery-icon">${kind === 'image' ? '🖼️' : '🎥'}</span>
              </div>
              <h3 class="gallery-title">${escapeHtml(item.title)}</h3>
              ${item.summary ? `<p class="gallery-summary">${escapeHtml(item.summary)}</p>` : ""}
            </div>
          `}
        </article>
      `).join("")}
    </div>

    ${kindItems.length === 0 ? `<p class="empty-message">No ${kind}s yet. Add some in Notion!</p>` : ""}
  </main>

  ${headerFooter.footer}
  ${headerFooter.script}
</body>
</html>`;

  await fs.writeFile(`site/${kind}s/index.html`, html, "utf8");
}

(async () => {
  const pages = await queryDatabaseAll();

  const items = [];
  for (const page of pages) {
    const title = getTitle(page);
    const kind = getSelect(page, "Kind") || "unknown";
    const summary = getRichText(page, "Summary") || "";
    const tags = getMultiSelect(page, "Tags");
    const driveUrl = (getProp(page, "Drive URL")?.url) || "";

    const slug = slugify(title);
    let localPath = "";
    let headings = [];

    if (kind === "article") {
      const blocks = await fetchBlocksAll(page.id);
      headings = extractHeadings(blocks);
      const contentHtml = blocksToHtml(blocks);
      localPath = await writeArticlePage({ 
        title, 
        slug, 
        contentHtml, 
        tags,
        date: page.last_edited_time,
        headings
      });
    }

    items.push({
      id: page.id,
      title,
      slug,
      kind,
      summary,
      tags,
      driveUrl,
      notionUrl: page.url,
      localPath,
      updatedTime: page.last_edited_time,
    });
  }

  // Write all pages
  await writeHomePage(items);
  await writePostsPage(items);
  await writeTagsPage(items);
  await writeAboutPage();
  await writeSubscribePage();
  await writeGalleryPage(items, "image");
  await writeGalleryPage(items, "video");

  // Keep the JSON for backwards compatibility
  await fs.mkdir("site/data", { recursive: true });
  await fs.writeFile("site/data/notion.json", JSON.stringify({ items }, null, 2), "utf8");

  console.log(`✓ Generated ${items.length} items`);
  console.log(`✓ Home page: site/index.html`);
  console.log(`✓ Posts page: site/posts/index.html`);
  console.log(`✓ Tags page: site/tags/index.html`);
  console.log(`✓ About page: site/about/index.html`);
  console.log(`✓ Subscribe page: site/subscribe/index.html`);
  console.log(`✓ Images gallery: site/images/index.html`);
  console.log(`✓ Videos gallery: site/videos/index.html`);
  console.log(`✓ JSON data: site/data/notion.json`);
})();
