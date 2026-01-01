// scripts/build.mjs
// Builds static site from Obsidian markdown files
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ffmpeg path (full path for Windows compatibility)
const FFMPEG_PATH = process.env.FFMPEG_PATH ||
  "C:\\Users\\kolin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0.1-full_build\\bin\\ffmpeg.exe";

// Generate video thumbnail using ffmpeg
async function generateVideoThumbnail(videoPath, outputPath) {
  try {
    // Extract frame at 1 second (or first frame if video is shorter)
    const cmd = `"${FFMPEG_PATH}" -y -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=640:-1" "${outputPath}"`;
    await execAsync(cmd);
    console.log(`  ↳ Generated thumbnail: ${path.basename(outputPath)}`);
    return true;
  } catch (error) {
    // Try first frame if 1 second fails
    try {
      const cmd = `"${FFMPEG_PATH}" -y -i "${videoPath}" -vframes 1 -vf "scale=640:-1" "${outputPath}"`;
      await execAsync(cmd);
      console.log(`  ↳ Generated thumbnail (first frame): ${path.basename(outputPath)}`);
      return true;
    } catch (e) {
      console.warn(`  ↳ Could not generate thumbnail: ${e.message}`);
      return false;
    }
  }
}

// Generate audio waveform image using ffmpeg
async function generateAudioWaveform(audioPath, outputPath) {
  try {
    // Create waveform visualization
    const cmd = `"${FFMPEG_PATH}" -y -i "${audioPath}" -filter_complex "showwavespic=s=640x200:colors=#4f46e5|#818cf8" -frames:v 1 "${outputPath}"`;
    await execAsync(cmd);
    console.log(`  ↳ Generated waveform: ${path.basename(outputPath)}`);
    return true;
  } catch (error) {
    console.warn(`  ↳ Could not generate waveform: ${error.message}`);
    return false;
  }
}

// Content source folder
const CONTENT_DIR = process.env.CONTENT_DIR || "content";

// Security headers for all pages
const getSecurityHeaders = () => `
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; media-src 'self' https: blob:; frame-src https://buttondown.com https://buttondown.email; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://buttondown.email;">
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="X-Frame-Options" content="DENY">
  <meta http-equiv="X-XSS-Protection" content="1; mode=block">
  <meta name="referrer" content="strict-origin-when-cross-origin">`;

const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";

function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Parse YAML frontmatter from markdown
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlStr = match[1];
  const body = match[2];
  const frontmatter = {};

  // Simple YAML parser for common fields
  for (const line of yamlStr.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Handle arrays like [tag1, tag2]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    }
    // Handle booleans
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    // Handle quoted strings
    else if ((value.startsWith('"') && value.endsWith('"')) ||
             (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

// Convert markdown to HTML (improved implementation)
function markdownToHtml(md) {
  let html = md;

  // Step 1: Extract and protect code blocks first (before any other processing)
  const codeBlocks = [];
  html = html.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `CODEBLOCKPLACEHOLDER${codeBlocks.length}ENDCODEBLOCK`;
    codeBlocks.push(`<pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(code.trim())}</code></pre>`);
    return placeholder;
  });

  // Step 2: Extract and process tables
  const tableRegex = /^\|(.+)\|\r?\n\|[-:\| ]+\|\r?\n((?:\|.+\|\r?\n?)+)/gm;
  html = html.replace(tableRegex, (match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
    const rows = bodyRows.trim().split('\n').map(row =>
      row.split('|').map(cell => cell.trim()).filter(cell => cell)
    );

    let table = '<table>\n<thead>\n<tr>';
    headers.forEach(h => { table += `<th>${h}</th>`; });
    table += '</tr>\n</thead>\n<tbody>\n';
    rows.forEach(row => {
      table += '<tr>';
      row.forEach(cell => { table += `<td>${cell}</td>`; });
      table += '</tr>\n';
    });
    table += '</tbody>\n</table>';
    return table;
  });

  // Step 3: Process block-level elements

  // Headings (process before inline formatting)
  html = html.replace(/^### (.+)$/gm, (match, text) => {
    return `<h4 id="${slugify(text)}"><span class="hash">###</span> ${text}</h4>`;
  });
  html = html.replace(/^## (.+)$/gm, (match, text) => {
    return `<h3 id="${slugify(text)}"><span class="hash">##</span> ${text}</h3>`;
  });
  html = html.replace(/^# (.+)$/gm, (match, text) => {
    return `<h2 id="${slugify(text)}"><span class="hash">#</span> ${text}</h2>`;
  });

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />');
  html = html.replace(/^\*\*\*$/gm, '<hr />');

  // Step 4: Process lists
  // Process unordered lists
  const lines = html.split('\n');
  const processedLines = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for unordered list item
    const ulMatch = trimmed.match(/^[\-\*] (.+)$/);
    // Check for ordered list item
    const olMatch = trimmed.match(/^\d+\. (.+)$/);

    if (ulMatch) {
      if (inOl) { processedLines.push('</ol>'); inOl = false; }
      if (!inUl) { processedLines.push('<ul>'); inUl = true; }
      processedLines.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (inUl) { processedLines.push('</ul>'); inUl = false; }
      if (!inOl) { processedLines.push('<ol>'); inOl = true; }
      processedLines.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inUl) { processedLines.push('</ul>'); inUl = false; }
      if (inOl) { processedLines.push('</ol>'); inOl = false; }
      processedLines.push(line);
    }
  }
  if (inUl) processedLines.push('</ul>');
  if (inOl) processedLines.push('</ol>');

  html = processedLines.join('\n');

  // Step 5: Process inline formatting

  // Images (before links to avoid conflict)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<figure><img src="$2" alt="$1" loading="lazy" /></figure>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Bold and italic (order matters: longest patterns first)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Inline code (after bold/italic to avoid conflicts)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Step 6: Wrap remaining lines in paragraphs
  const finalLines = html.split('\n');
  const wrapped = [];

  for (let line of finalLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      wrapped.push('');
      continue;
    }
    // Skip lines that are already HTML elements or code block placeholders
    if (trimmed.startsWith('<') || trimmed.startsWith('CODEBLOCKPLACEHOLDER')) {
      wrapped.push(line);
      continue;
    }
    wrapped.push(`<p>${line}</p>`);
  }

  html = wrapped.join('\n');

  // Step 7: Restore code blocks
  codeBlocks.forEach((block, i) => {
    html = html.replace(`CODEBLOCKPLACEHOLDER${i}ENDCODEBLOCK`, block);
    html = html.replace(`<p>CODEBLOCKPLACEHOLDER${i}ENDCODEBLOCK</p>`, block);
  });

  // Clean up
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>(<h[234])/g, '$1');
  html = html.replace(/(<\/h[234]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<table)/g, '$1');
  html = html.replace(/(<\/table>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul|<ol|<\/ul|<\/ol|<li|<\/li|<hr|<blockquote|<\/blockquote|<figure|<pre)/g, '$1');

  return html;
}

// Extract headings for TOC
function extractHeadings(html) {
  const headings = [];
  const regex = /<h([234]) id="([^"]+)">.*?<\/span>\s*(.+?)<\/h\1>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, '')
    });
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

// Copy media files to site folder and generate thumbnails
async function copyMedia(srcPath, title, kind = 'image') {
  if (!srcPath) return { mediaUrl: '', thumbnailUrl: '' };

  try {
    const filename = path.basename(srcPath);
    const hash = crypto.createHash('md5').update(srcPath).digest('hex').slice(0, 8);
    const ext = path.extname(filename).toLowerCase();
    const newFilename = `${slugify(title)}${ext}`;
    const destDir = path.join('site', 'media');
    const destPath = path.join(destDir, newFilename);

    await fs.mkdir(destDir, { recursive: true });

    // Copy file
    await fs.copyFile(srcPath, destPath);
    console.log(`  ↳ Copied: ${newFilename}`);

    const mediaUrl = `/notion-site-test/media/${newFilename}`;
    let thumbnailUrl = '';

    // Generate thumbnails for video/audio
    if (kind === 'video' && ['.mp4', '.webm', '.mov'].includes(ext)) {
      const thumbFilename = `${slugify(title)}-thumb.jpg`;
      const thumbPath = path.join(destDir, thumbFilename);
      const success = await generateVideoThumbnail(destPath, thumbPath);
      if (success) {
        thumbnailUrl = `/notion-site-test/media/${thumbFilename}`;
      }
    } else if (kind === 'music' && ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
      const waveFilename = `${slugify(title)}-waveform.png`;
      const wavePath = path.join(destDir, waveFilename);
      const success = await generateAudioWaveform(destPath, wavePath);
      if (success) {
        thumbnailUrl = `/notion-site-test/media/${waveFilename}`;
      }
    } else if (kind === 'image') {
      thumbnailUrl = mediaUrl; // Images are their own thumbnails
    }

    return { mediaUrl, thumbnailUrl };
  } catch (error) {
    console.warn(`  ↳ Error copying media:`, error.message);
    return { mediaUrl: '', thumbnailUrl: '' };
  }
}

// Read all content files
async function readContentFiles() {
  const items = [];

  try {
    const files = await fs.readdir(CONTENT_DIR, { recursive: true });

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      // Skip CLAUDE.md files (workspace documentation)
      if (file.toUpperCase().includes('CLAUDE.MD')) continue;

      const filePath = path.join(CONTENT_DIR, file);
      const content = await fs.readFile(filePath, 'utf8');
      const { frontmatter, body } = parseFrontmatter(content);

      // Skip unpublished items
      if (frontmatter.publish === false) continue;

      const title = frontmatter.title || path.basename(file, '.md');
      const kind = (frontmatter.kind || 'article').toLowerCase();
      const slug = slugify(title);

      console.log(`Processing: ${title} (${kind})`);

      // Handle media files
      let thumbnailUrl = '';
      let mediaUrl = '';

      // For images, use the image frontmatter
      if (frontmatter.image) {
        const imagePath = path.join(CONTENT_DIR, frontmatter.image);
        const result = await copyMedia(imagePath, title, 'image');
        thumbnailUrl = result.thumbnailUrl;
        mediaUrl = result.mediaUrl;
      }

      // For videos/music, use the url frontmatter
      if (frontmatter.url && (kind === 'video' || kind === 'music')) {
        // Check if it's already an absolute URL path (starts with /)
        if (frontmatter.url.startsWith('/')) {
          // It's an existing deployed path - check if file exists and generate thumbnail
          const existingPath = path.join('site', frontmatter.url.replace(/^\/notion-site-test\//, ''));
          try {
            await fs.access(existingPath);
            mediaUrl = frontmatter.url;
            // Generate thumbnail from existing file
            const destDir = path.join('site', 'media');
            if (kind === 'video') {
              const thumbFilename = `${slugify(title)}-thumb.jpg`;
              const thumbPath = path.join(destDir, thumbFilename);
              const success = await generateVideoThumbnail(existingPath, thumbPath);
              if (success) {
                thumbnailUrl = `/notion-site-test/media/${thumbFilename}`;
              }
            } else if (kind === 'music') {
              const waveFilename = `${slugify(title)}-waveform.png`;
              const wavePath = path.join(destDir, waveFilename);
              const success = await generateAudioWaveform(existingPath, wavePath);
              if (success) {
                thumbnailUrl = `/notion-site-test/media/${waveFilename}`;
              }
            }
          } catch {
            console.warn(`  ↳ Media file not found: ${existingPath}`);
          }
        } else {
          // It's a relative path - copy the file
          const mediaPath = path.join(CONTENT_DIR, frontmatter.url);
          const result = await copyMedia(mediaPath, title, kind);
          mediaUrl = result.mediaUrl;
          thumbnailUrl = result.thumbnailUrl || thumbnailUrl;
        }
      }

      // Convert markdown to HTML for articles
      let contentHtml = '';
      let headings = [];
      let readingTime = 1;

      if (kind === 'article') {
        contentHtml = markdownToHtml(body);
        headings = extractHeadings(contentHtml);

        // Calculate reading time
        const wordCount = body.split(/\s+/).filter(w => w.length > 0).length;
        readingTime = Math.max(1, Math.ceil(wordCount / 200));
      }

      items.push({
        title,
        slug,
        kind,
        summary: frontmatter.summary || '',
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        thumbnailUrl,
        driveUrl: mediaUrl || thumbnailUrl,
        contentHtml,
        headings,
        readingTime,
        date: frontmatter.date || new Date().toISOString().split('T')[0],
        updatedTime: frontmatter.date || new Date().toISOString()
      });
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`Content directory "${CONTENT_DIR}" not found. Creating sample content...`);
      await createSampleContent();
      return readContentFiles();
    }
    throw error;
  }

  return items;
}

// Create sample content folder and files
async function createSampleContent() {
  await fs.mkdir(CONTENT_DIR, { recursive: true });

  const samplePost = `---
title: Welcome to Kol's Korner
kind: article
date: 2026-01-01
tags: [welcome, intro]
summary: Welcome to my new site! Here I'll share thoughts on tech, AI, and development.
publish: true
---

# Welcome

Hello and welcome to my new site!

## What to Expect

I'll be sharing:

- **Tech insights** - Latest developments in software
- **AI explorations** - Experiments and discoveries
- **Development tips** - Things I've learned along the way

## Stay Tuned

More content coming soon. Feel free to explore and check back regularly!

---

*Thanks for visiting!*
`;

  await fs.writeFile(path.join(CONTENT_DIR, 'welcome.md'), samplePost, 'utf8');
  console.log('Created sample content file: welcome.md');
}

async function writeArticlePage({ title, slug, contentHtml, tags, date, headings, readingTime }) {
  const outDir = path.join("site", "posts", slug);
  await fs.mkdir(outDir, { recursive: true });

  const toc = generateTOC(headings);
  const tagsHtml = tags.length ? `<div class="post-tags">${tags.map(t => `<a href="/notion-site-test/tags/#${slugify(t)}" class="tag">${escapeHtml(t)}</a>`).join("")}</div>` : "";

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${getSecurityHeaders()}
  <title>${escapeHtml(title)} - Kol's Korner</title>
  <meta name="description" content="${escapeHtml((contentHtml.replace(/<[^>]*>/g, '').slice(0, 160)))}..." />
  <meta name="author" content="Kol Tregaskes" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml((contentHtml.replace(/<[^>]*>/g, '').slice(0, 160)))}..." />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:creator" content="@koltregaskes" />
  <link rel="icon" type="image/x-icon" href="/notion-site-test/favicon.ico" />
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
        <a href="/notion-site-test/music/">Music</a>
        <a href="/notion-site-test/about/">About</a>
        <a href="/notion-site-test/subscribe/">Newsletter</a>
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
            <time class="post-date">${date ? new Date(date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }) : ""}</time>
            <span class="meta-sep">•</span>
            <span class="reading-time">${readingTime} min read</span>
          </div>
        </header>
        <div class="post-content">
          ${contentHtml}
        </div>
        ${tagsHtml}
      </article>
    </main>
  </div>

  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2026 All rights reserved.</p>
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
  return { localPath: `/posts/${slug}/`, readingTime };
}

async function writeHomePage(items) {
  const sortedItems = items.sort((a, b) => new Date(b.updatedTime) - new Date(a.updatedTime));

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${getSecurityHeaders()}
  <title>Kol's Korner - Tech, AI, Development & More</title>
  <meta name="description" content="Hi. My name is Kol Tregaskes. I'm a software developer and AI enthusiast based in the UK. Articles, images, videos, and music about tech, AI, and development." />
  <meta name="author" content="Kol Tregaskes" />
  <meta property="og:title" content="Kol's Korner" />
  <meta property="og:description" content="Tech, AI, Development & More" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:creator" content="@koltregaskes" />
  <link rel="icon" type="image/x-icon" href="./favicon.ico" />
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
        <a href="./music/">Music</a>
        <a href="./about/">About</a>
        <a href="./subscribe/">Newsletter</a>
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
      <h1 class="intro-title">Welcome to Kol's Korner</h1>
      <p class="intro-text">Tech, AI, development, and creative experiments. Articles, images, videos, and more.</p>
    </div>

    <!-- Content Filters -->
    <div class="content-filters">
      <label class="filter-label">
        <input type="checkbox" value="article" checked> Articles
      </label>
      <label class="filter-label">
        <input type="checkbox" value="image" checked> Images
      </label>
      <label class="filter-label">
        <input type="checkbox" value="video" checked> Videos
      </label>
      <label class="filter-label">
        <input type="checkbox" value="music" checked> Music
      </label>
    </div>

    <!-- Content Grid -->
    <div class="content-grid" id="contentGrid">
      ${sortedItems.map(item => {
        const kind = (item.kind || 'unknown').toLowerCase();
        const title = escapeHtml(item.title);
        const summary = escapeHtml(item.summary || '');
        // Check if we have a generated thumbnail (jpg/png/gif) for display
        const hasImageThumbnail = item.thumbnailUrl && item.thumbnailUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);

        let linkUrl = '#';
        if (kind === 'article') {
          linkUrl = `./posts/${item.slug}/`;
        } else if (kind === 'image') {
          linkUrl = `./images/`;
        } else if (kind === 'video') {
          linkUrl = `./videos/`;
        } else if (kind === 'music') {
          linkUrl = `./music/`;
        }

        return `
          <article class="content-card" data-kind="${kind}">
            <a href="${linkUrl}" class="content-card-link">
              ${hasImageThumbnail ? `
                <div class="content-card-media${kind === 'video' ? ' has-thumbnail' : ''}">
                  <img src="${escapeHtml(item.thumbnailUrl)}" alt="${title}" loading="lazy" />
                  ${kind === 'video' ? `<svg class="play-overlay" viewBox="0 0 24 24" fill="currentColor" width="48" height="48"><path d="M8 5v14l11-7z"/></svg>` : ''}
                  <span class="content-kind-badge">${kind}</span>
                </div>
              ` : kind === 'video' ? `
                <div class="content-card-media video-placeholder">
                  <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <span class="content-kind-badge">${kind}</span>
                </div>
              ` : kind === 'music' ? `
                <div class="content-card-media music-placeholder">
                  <svg class="music-icon" viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                  <span class="content-kind-badge">${kind}</span>
                </div>
              ` : ''}

              <div class="content-card-body">
                ${kind !== 'image' && kind !== 'video' && kind !== 'music' ? `<span class="content-kind-badge">${kind}</span>` : ''}
                <h3 class="content-card-title">${title}</h3>
                ${summary ? `<p class="content-card-summary">${summary}</p>` : ''}
                ${kind === 'article' && item.readingTime ? `
                  <div class="content-card-meta">
                    <time>${new Date(item.updatedTime).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}</time>
                    <span class="meta-sep">•</span>
                    <span>${item.readingTime} min read</span>
                  </div>
                ` : ''}
              </div>
            </a>
          </article>
        `;
      }).join("")}
    </div>
  </main>

  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2026 All rights reserved.</p>
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

    // Content filtering
    const filterCheckboxes = document.querySelectorAll('.content-filters input[type="checkbox"]');
    const contentCards = document.querySelectorAll('.content-card');

    function applyFilters() {
      const activeFilters = Array.from(filterCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      contentCards.forEach(card => {
        const cardKind = card.getAttribute('data-kind');
        if (activeFilters.length === 0 || activeFilters.includes(cardKind)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    }

    filterCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', applyFilters);
    });
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
  ${getSecurityHeaders()}
  <title>Posts - Kol's Korner</title>
  <meta name="description" content="Browse all posts by Kol Tregaskes - Tech, Software Development & More" />
  <meta name="author" content="Kol Tregaskes" />
  <link rel="icon" type="image/x-icon" href="../favicon.ico" />
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
        <a href="../music/">Music</a>
        <a href="../about/">About</a>
        <a href="../subscribe/">Newsletter</a>
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
        return `
          <article class="post-item">
            <a href="./${item.slug}/" class="post-link">
              <h3 class="post-item-title">${escapeHtml(item.title)}</h3>
              <p class="post-item-summary">${escapeHtml(item.summary || "")}</p>
              <div class="post-item-meta">
                <time>${new Date(item.date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</time>
                <span class="meta-sep">•</span>
                <span>${item.readingTime} min read</span>
              </div>
            </a>
          </article>
        `;
      }).join("")}
    </div>
  </main>

  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2026 All rights reserved.</p>
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

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${getSecurityHeaders()}
  <title>Tags - Kol's Korner</title>
  <meta name="description" content="Browse posts by tag - Tech, Software Development & More" />
  <link rel="icon" type="image/x-icon" href="../favicon.ico" />
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
        <a href="../posts/">Posts</a>
        <a href="./" class="active">Tags</a>
        <a href="../images/">Images</a>
        <a href="../videos/">Videos</a>
        <a href="../music/">Music</a>
        <a href="../about/">About</a>
        <a href="../subscribe/">Newsletter</a>
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
    <h1 class="page-title">Tags</h1>

    ${sortedTags.length === 0 ? '<p class="empty-message">No tags yet. Add tags to your posts!</p>' : ''}

    ${sortedTags.map(([tag, count]) => {
      const tagPosts = items.filter(i => i.kind === "article" && i.tags.includes(tag));
      const tagId = slugify(tag);
      return `
        <section class="tag-group" id="${tagId}">
          <h2 class="tag-group-title">
            <span class="hash">#</span>${escapeHtml(tag)} <span class="tag-group-count">(${count})</span>
          </h2>
          <div class="posts-list">
            ${tagPosts.map(item => {
              return `
                <article class="post-item">
                  <a href="../posts/${item.slug}/" class="post-link">
                    <h3 class="post-item-title">${escapeHtml(item.title)}</h3>
                    <p class="post-item-summary">${escapeHtml(item.summary || "")}</p>
                    <div class="post-item-meta">
                      <time>${new Date(item.date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</time>
                      <span class="meta-sep">•</span>
                      <span>${item.readingTime} min read</span>
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

  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2026 All rights reserved.</p>
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

  await fs.writeFile("site/tags/index.html", html, "utf8");
}

async function writeAboutPage() {
  await fs.mkdir("site/about", { recursive: true });

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${getSecurityHeaders()}
  <title>About - Kol's Korner</title>
  <meta name="description" content="About Kol Tregaskes - Software developer and tech enthusiast based in the UK" />
  <link rel="icon" type="image/x-icon" href="../favicon.ico" />
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
        <a href="../posts/">Posts</a>
        <a href="../tags/">Tags</a>
        <a href="../images/">Images</a>
        <a href="../videos/">Videos</a>
        <a href="../music/">Music</a>
        <a href="./" class="active">About</a>
        <a href="../subscribe/">Newsletter</a>
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
    <article class="about-content">
      <h1 class="page-title">About</h1>
      <div class="about-body">
        <p>Hi. My name is Kol Tregaskes. I'm a software developer and tech enthusiast based in the UK.</p>
        <p>This blog is about tech, software development, and other topics that interest me.</p>
        <p>You can find me on <a href="https://twitter.com/koltregaskes" target="_blank">Twitter</a>, <a href="https://instagram.com/koltregaskes" target="_blank">Instagram</a>, and <a href="https://youtube.com/@koltregaskes" target="_blank">YouTube</a>.</p>
      </div>
    </article>
  </main>

  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2026 All rights reserved.</p>
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

  await fs.writeFile("site/about/index.html", html, "utf8");
}

async function writeSubscribePage() {
  await fs.mkdir("site/subscribe", { recursive: true });

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${getSecurityHeaders()}
  <title>Newsletter - Kol's Korner</title>
  <meta name="description" content="Subscribe to Kol's Korner newsletter - Weekly digests, daily updates, or all new posts about tech, AI, and development" />
  <link rel="icon" type="image/x-icon" href="../favicon.ico" />
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
        <a href="../posts/">Posts</a>
        <a href="../tags/">Tags</a>
        <a href="../images/">Images</a>
        <a href="../videos/">Videos</a>
        <a href="../music/">Music</a>
        <a href="../about/">About</a>
        <a href="./" class="active">Newsletter</a>
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
    <div class="subscribe-content">
      <h1 class="page-title">Newsletter</h1>
      <p class="subscribe-text">Get notified when new posts are published. Articles on tech, AI, and development delivered to your inbox.</p>

      <form
        action="https://buttondown.email/api/emails/embed-subscribe/koltregaskes"
        method="post"
        target="popupwindow"
        onsubmit="window.open('https://buttondown.email/koltregaskes', 'popupwindow')"
        class="newsletter-form"
      >
        <div class="form-row">
          <input type="email" name="email" id="bd-email" placeholder="your@email.com" required />
          <button type="submit">Subscribe</button>
        </div>
      </form>

      <p class="subscribe-note">No spam, unsubscribe at any time.</p>
      <p class="subscribe-note" style="margin-top: 16px;">
        <a href="/notion-site-test/feed.xml" style="color: var(--color-primary);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px;">
            <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36m0-12.64a14.18 14.18 0 0 1 14.18 14.18h-3.64a10.55 10.55 0 0 0-10.54-10.55V3m0 5.09a9.09 9.09 0 0 1 9.09 9.09H11.64a5.45 5.45 0 0 0-5.46-5.45V8.09z"/>
          </svg>
          RSS Feed
        </a>
      </p>
    </div>
  </main>

  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2026 All rights reserved.</p>
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
    document.getElementById('subscribeForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const email = document.getElementById('emailInput').value;
      const message = document.getElementById('subscribeMessage');
      const button = document.querySelector('.subscribe-button');

      button.disabled = true;
      button.textContent = 'Subscribing...';

      setTimeout(() => {
        message.textContent = '✓ Thanks! Newsletter integration coming soon.';
        message.style.color = 'var(--color-primary)';
        button.textContent = 'Subscribed!';
      }, 1000);
    });

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

  await fs.writeFile("site/subscribe/index.html", html, "utf8");
}

async function writeGalleryPage(items, kind) {
  const kindItems = items
    .filter(i => i.kind === kind)
    .sort((a, b) => new Date(b.updatedTime) - new Date(a.updatedTime));

  // Proper pluralization (music stays music, not musics)
  const kindPlural = kind === 'music' ? 'music' : kind + 's';
  const kindName = kind.charAt(0).toUpperCase() + kind.slice(1) + (kind === 'music' ? '' : 's');

  await fs.mkdir(`site/${kindPlural}`, { recursive: true });

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${getSecurityHeaders()}
  <title>${kindName} - Kol's Korner</title>
  <meta name="description" content="${kindName} gallery by Kol Tregaskes" />
  <link rel="icon" type="image/x-icon" href="../favicon.ico" />
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
        <a href="../posts/">Posts</a>
        <a href="../tags/">Tags</a>
        <a href="../images/"${kind === 'image' ? ' class="active"' : ''}>Images</a>
        <a href="../videos/"${kind === 'video' ? ' class="active"' : ''}>Videos</a>
        <a href="../music/"${kind === 'music' ? ' class="active"' : ''}>Music</a>
        <a href="../about/">About</a>
        <a href="../subscribe/">Newsletter</a>
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
    <h1 class="page-title">${kindName}</h1>

    <div class="gallery-grid">
      ${kindItems.map(item => {
        // driveUrl is the actual media file (mp4, mp3), thumbnailUrl is the generated thumbnail
        const playableUrl = item.driveUrl || '';
        const isVideo = kind === 'video';
        const isAudio = kind === 'music';
        // Check if we have a generated thumbnail (jpg/png) for video/music
        const hasImageThumbnail = item.thumbnailUrl && item.thumbnailUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);

        return `
        <article class="gallery-item">
          <div class="gallery-thumbnail${hasImageThumbnail && isVideo ? ' has-thumbnail' : ''}" onclick="openModal('${escapeHtml(playableUrl)}', '${escapeHtml(item.title)}', '${kind}')">
            ${hasImageThumbnail ? `
              <img src="${escapeHtml(item.thumbnailUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" />
              ${isVideo ? `<svg class="play-overlay" viewBox="0 0 24 24" fill="currentColor" width="48" height="48"><path d="M8 5v14l11-7z"/></svg>` : ''}
            ` : isVideo ? `
              <div class="gallery-placeholder video-placeholder">
                <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <span class="gallery-icon-label">Video</span>
              </div>
            ` : isAudio ? `
              <div class="gallery-placeholder music-placeholder">
                <svg class="music-icon" viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <span class="gallery-icon-label">Music</span>
              </div>
            ` : playableUrl ? `
              <img src="${escapeHtml(playableUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" />
            ` : `
              <div class="gallery-placeholder">
                <span class="gallery-icon">${kind === 'image' ? '🖼️' : kind === 'video' ? '🎥' : '🎵'}</span>
              </div>
            `}
          </div>
          <div class="gallery-info">
            <h3 class="gallery-title">${escapeHtml(item.title)}</h3>
            ${item.summary ? `<p class="gallery-summary">${escapeHtml(item.summary)}</p>` : ""}
          </div>
        </article>
      `}).join("")}
    </div>

    ${kindItems.length === 0 ? `<p class="empty-message">No ${kind}s yet. Add some to your content folder!</p>` : ""}
  </main>

  <!-- Modal for full-size view -->
  <div id="modal" class="modal">
    <span class="modal-close" onclick="closeModal()">&times;</span>
    <button class="modal-nav modal-nav-prev" onclick="navigateGallery(-1); event.stopPropagation();">‹</button>
    <button class="modal-nav modal-nav-next" onclick="navigateGallery(1); event.stopPropagation();">›</button>
    <div class="modal-content" onclick="event.stopPropagation();">
      <img id="modal-image" class="modal-media" />
      <video id="modal-video" class="modal-media" controls style="display:none;"></video>
      <div id="modal-audio-container" class="modal-audio-container" style="display:none;">
        <div class="audio-artwork">
          <svg viewBox="0 0 24 24" fill="currentColor" width="80" height="80">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        <h3 id="modal-audio-title" class="audio-title"></h3>
        <audio id="modal-audio" controls></audio>
      </div>
    </div>
  </div>

  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2026 All rights reserved.</p>
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
    const galleryItems = ${JSON.stringify(kindItems.map(item => ({
      url: item.thumbnailUrl || item.driveUrl || '',
      title: item.title,
      kind: kind
    })))};

    let currentIndex = 0;

    function openModal(url, title, kind) {
      if (!url) return;
      currentIndex = galleryItems.findIndex(item => item.url === url);
      if (currentIndex === -1) currentIndex = 0;
      showModalItem(currentIndex);
      document.getElementById('modal').style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function showModalItem(index) {
      const item = galleryItems[index];
      if (!item || !item.url) return;
      const img = document.getElementById('modal-image');
      const video = document.getElementById('modal-video');
      const audioContainer = document.getElementById('modal-audio-container');
      const audio = document.getElementById('modal-audio');
      const audioTitle = document.getElementById('modal-audio-title');

      // Hide all first
      img.style.display = 'none';
      video.style.display = 'none';
      audioContainer.style.display = 'none';

      if (item.kind === 'video') {
        video.style.display = 'block';
        video.src = item.url;
      } else if (item.kind === 'music') {
        audioContainer.style.display = 'flex';
        audio.src = item.url;
        audioTitle.textContent = item.title;
      } else {
        img.style.display = 'block';
        img.src = item.url;
      }
    }

    function navigateGallery(direction) {
      currentIndex = (currentIndex + direction + galleryItems.length) % galleryItems.length;
      showModalItem(currentIndex);
    }

    function closeModal() {
      const modal = document.getElementById('modal');
      const video = document.getElementById('modal-video');
      const audio = document.getElementById('modal-audio');
      modal.style.display = 'none';
      video.pause();
      video.src = '';
      audio.pause();
      audio.src = '';
      document.body.style.overflow = 'auto';
    }

    document.addEventListener('keydown', function(e) {
      const modal = document.getElementById('modal');
      if (modal.style.display === 'flex') {
        if (e.key === 'ArrowLeft') navigateGallery(-1);
        else if (e.key === 'ArrowRight') navigateGallery(1);
        else if (e.key === 'Escape') closeModal();
      }
    });

    document.getElementById('modal').addEventListener('wheel', function(e) {
      e.preventDefault();
      navigateGallery(e.deltaY > 0 ? 1 : -1);
    });

    document.getElementById('modal').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });

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

  await fs.writeFile(`site/${kindPlural}/index.html`, html, "utf8");
}

// Generate RSS feed
async function writeRssFeed(items) {
  const siteUrl = 'https://koltregaskes.github.io/notion-site-test';
  const articles = items
    .filter(item => item.kind === 'article')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20); // Last 20 articles

  const rssItems = articles.map(item => {
    const pubDate = new Date(item.date).toUTCString();
    const link = `${siteUrl}/posts/${item.slug}/`;

    return `
    <item>
      <title>${escapeHtml(item.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeHtml(item.summary || '')}</description>
      ${item.tags.map(tag => `<category>${escapeHtml(tag)}</category>`).join('\n      ')}
    </item>`;
  }).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Kol's Korner</title>
    <link>${siteUrl}</link>
    <description>Tech, AI, Development &amp; More by Kol Tregaskes</description>
    <language>en-gb</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;

  await fs.writeFile('site/feed.xml', rss, 'utf8');
}

// Main build function
(async () => {
  console.log('Building site from Obsidian markdown files...\n');
  console.log(`Content directory: ${CONTENT_DIR}\n`);

  // Read all content
  const items = await readContentFiles();

  // Write article pages
  for (const item of items) {
    if (item.kind === 'article') {
      const result = await writeArticlePage({
        title: item.title,
        slug: item.slug,
        contentHtml: item.contentHtml,
        tags: item.tags,
        date: item.date,
        headings: item.headings,
        readingTime: item.readingTime
      });
      item.localPath = result.localPath;
    }
  }

  // Write all pages
  await writeHomePage(items);
  await writePostsPage(items);
  await writeTagsPage(items);
  await writeAboutPage();
  await writeSubscribePage();
  await writeGalleryPage(items, "image");
  await writeGalleryPage(items, "video");
  await writeGalleryPage(items, "music");

  // Write JSON data and RSS feed
  await fs.mkdir("site/data", { recursive: true });
  await fs.writeFile("site/data/content.json", JSON.stringify({ items }, null, 2), "utf8");
  await writeRssFeed(items);

  console.log(`\n✓ Generated ${items.length} items`);
  console.log(`✓ Home page: site/index.html`);
  console.log(`✓ Posts page: site/posts/index.html`);
  console.log(`✓ Tags page: site/tags/index.html`);
  console.log(`✓ About page: site/about/index.html`);
  console.log(`✓ Newsletter page: site/subscribe/index.html`);
  console.log(`✓ Images gallery: site/images/index.html`);
  console.log(`✓ Videos gallery: site/videos/index.html`);
  console.log(`✓ Music gallery: site/music/index.html`);
  console.log(`✓ RSS feed: site/feed.xml`);
  console.log(`✓ JSON data: site/data/content.json`);
  console.log('\nBuild complete!');
})();
