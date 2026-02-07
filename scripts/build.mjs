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

  // Callouts (must come before regular blockquotes)
  html = html.replace(/^> \[!(NOTE|TIP|WARNING|IMPORTANT)\]([^\n]*)\n((?:^>.*\n?)*)/gm, (match, type, title, content) => {
    const calloutType = type.toLowerCase();
    const displayTitle = title.trim() || type.charAt(0) + type.slice(1).toLowerCase();
    const cleanContent = content.split('\n').map(l => l.replace(/^>\s?/, '')).join('\n').trim();
    return `<div class="callout callout-${calloutType}"><div class="callout-title">${displayTitle}</div><div class="callout-content">${cleanContent}</div></div>`;
  });

  // Regular blockquotes
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

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Highlighting
  html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');

  // Wikilinks [[note]] or [[note|display text]]
  html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, noteName, displayText) => {
    const slug = noteName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/--+/g, '-');
    const linkText = displayText?.trim() || noteName.trim();
    return `<a href="/notion-site-test/posts/${slug}/" class="wikilink">${linkText}</a>`;
  });

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

// Reusable header/navigation HTML (blog-only navigation)
function getHeaderHTML(basePath = '/notion-site-test/') {
  return `
  <header class="site-header">
    <div class="header-content">
      <a href="${basePath}" class="site-logo">
        <span class="logo-icon">K</span>
        <span class="logo-text">Kol's Korner</span>
      </a>
      <nav class="site-nav">
        <a href="${basePath}posts/">Posts</a>
        <a href="${basePath}tags/">Tags</a>
        <a href="${basePath}about/">About</a>
        <a href="${basePath}subscribe/">Newsletter</a>
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
}

// Reusable footer HTML
function getFooterHTML() {
  return `
  <footer class="site-footer">
    <div class="footer-content">
      <p>&copy; 2026 All rights reserved.</p>
      <p class="footer-credit">Made in the UK by Kol Tregaskes. Design inspired by <a href="https://justoffbyone.com" target="_blank" rel="noopener">Off by One</a>.</p>
    </div>
    <div class="footer-social">
      <a href="https://x.com/koltregaskes" aria-label="X (Twitter)" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </a>
      <a href="https://www.threads.com/@koltregaskes" aria-label="Threads" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.88-.73 2.123-1.149 3.503-1.18 1.016-.023 1.97.092 2.862.345-.034-1.466-.383-2.417-1.25-3.058-.707-.521-1.675-.79-2.878-.8h-.015c-1.124.01-2.038.267-2.716.764l-1.085-1.768c1.02-.749 2.326-1.128 3.887-1.128h.02c3.295.02 5.266 1.88 5.482 5.175.125.084.247.172.364.266 1.378 1.103 2.084 2.605 2.042 4.348-.06 2.467-1.217 4.381-3.255 5.381-1.456.714-3.282 1.075-5.434 1.075z"/>
        </svg>
      </a>
      <a href="https://mastodon.social/@koltregaskes" aria-label="Mastodon" target="_blank" rel="noopener me">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.668 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"/>
        </svg>
      </a>
      <a href="https://www.instagram.com/koltregaskes/" aria-label="Instagram" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
        </svg>
      </a>
      <a href="https://www.youtube.com/koltregaskes" aria-label="YouTube" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      </a>
      <a href="https://www.tiktok.com/@koltregaskes" aria-label="TikTok" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
        </svg>
      </a>
      <a href="https://github.com/koltregaskes" aria-label="GitHub" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
      </a>
    </div>
  </footer>`;
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
      // Skip CLAUDE.md files and pages/ folder (static pages handled separately)
      if (file.toUpperCase().includes('CLAUDE.MD')) continue;
      if (file.startsWith('pages/') || file.startsWith('pages\\')) continue;
      if (file.startsWith('templates/') || file.startsWith('templates\\')) continue;

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
  ${getHeaderHTML('/notion-site-test/')}

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

  ${getFooterHTML()}

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

// Write a dedicated digest page with special styling
async function writeDigestPage({ title, slug, contentHtml, tags, date, readingTime, digestData }) {
  const outDir = path.join("site", "posts", slug);
  await fs.mkdir(outDir, { recursive: true });

  const displayDate = new Date(date).toLocaleDateString("en-GB", {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const tagsHtml = tags.length ? `<div class="post-tags">${tags.map(t => `<a href="/notion-site-test/tags/#${slugify(t)}" class="tag">${escapeHtml(t)}</a>`).join("")}</div>` : "";

  // External link icon SVG
  const externalLinkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${getSecurityHeaders()}
  <title>${escapeHtml(title)} - Kol's Korner</title>
  <meta name="description" content="AI and technology news digest for ${displayDate}" />
  <meta name="author" content="Kol Tregaskes" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="AI and technology news digest for ${displayDate}" />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:creator" content="@koltregaskes" />
  <link rel="icon" type="image/x-icon" href="/notion-site-test/favicon.ico" />
  <link rel="stylesheet" href="/notion-site-test/styles.css" />
</head>
<body>
  ${getHeaderHTML('/notion-site-test/')}

  <main class="content-main">
    <article class="post">
      <!-- Digest Header -->
      <header class="digest-header">
        <span class="digest-badge">Daily Digest</span>
        <h1 class="digest-title">${displayDate}</h1>
        <p class="digest-subtitle">Today's AI news, curated by Kol</p>
      </header>

      <p class="digest-intro">Welcome to today's roundup of the most interesting developments in AI and technology.</p>

      <!-- Digest Content -->
      <div class="post-content digest-content">
        ${contentHtml}
      </div>

      <footer class="digest-footer">
        <p>This digest was automatically generated • ${readingTime} min read</p>
      </footer>

      ${tagsHtml}
    </article>
  </main>

  ${getFooterHTML()}

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
  <meta name="description" content="Hi. My name is Kol Tregaskes. I'm a software developer and AI enthusiast based in the UK. Writing about AI agents, creative tools, and technology." />
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
  ${getHeaderHTML('./')}

  <main class="home-main">
    <div class="home-intro">
      <h1 class="intro-title">Welcome to Kol's Korner</h1>
      <p class="intro-text">Tech, AI, development, and creative experiments from a software developer and AI enthusiast based in the UK.</p>
    </div>

    <!-- Article Grid -->
    <div class="content-grid" id="contentGrid">
      ${sortedItems.filter(item => (item.kind || 'article').toLowerCase() === 'article').map(item => {
        const title = escapeHtml(item.title);
        const summary = escapeHtml(item.summary || '');
        const linkUrl = `./posts/${item.slug}/`;
        const hasImage = item.thumbnailUrl && item.thumbnailUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);

        return `
          <article class="content-card">
            <a href="${linkUrl}" class="content-card-link">
              ${hasImage ? `
                <div class="content-card-media">
                  <img src="${escapeHtml(item.thumbnailUrl)}" alt="${title}" loading="lazy" />
                </div>
              ` : `
                <div class="content-card-media placeholder">
                  <div class="placeholder-icon">📝</div>
                </div>
              `}
              <div class="content-card-body">
                <h3 class="content-card-title">${title}</h3>
                ${summary ? `<p class="content-card-summary">${summary}</p>` : ''}
                ${item.readingTime ? `
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

  ${getFooterHTML()}

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
  ${getSecurityHeaders()}
  <title>Posts - Kol's Korner</title>
  <meta name="description" content="Browse all posts by Kol Tregaskes - Tech, Software Development & More" />
  <meta name="author" content="Kol Tregaskes" />
  <link rel="icon" type="image/x-icon" href="../favicon.ico" />
  <link rel="stylesheet" href="../styles.css" />
</head>
<body>
  ${getHeaderHTML('../')}

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

  ${getFooterHTML()}

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
  ${getHeaderHTML('../')}

  <main class="content-main">
    <h1 class="page-title">Tags</h1>

    ${sortedTags.length === 0 ? '<p class="empty-message">No tags yet. Add tags to your posts!</p>' : `
    <!-- Tag Cloud -->
    <nav class="tag-cloud" aria-label="Filter by tag">
      <a href="#" class="active" data-tag="all">All <span class="tag-count">(${items.filter(i => i.kind === "article").length})</span></a>
      ${sortedTags.map(([tag, count]) => {
        const tagId = slugify(tag);
        return `<a href="#${tagId}" data-tag="${tagId}">${escapeHtml(tag)} <span class="tag-count">(${count})</span></a>`;
      }).join("\n      ")}
    </nav>

    <!-- Tag Sections -->
    ${sortedTags.map(([tag, count]) => {
      const tagPosts = items.filter(i => i.kind === "article" && i.tags.includes(tag));
      const tagId = slugify(tag);
      return `
    <section class="tag-section" id="${tagId}" data-tag="${tagId}">
      <header class="tag-section-header">
        <h2 class="tag-section-title"><span class="hash">#</span>${escapeHtml(tag)}</h2>
        <span class="tag-section-count">${count} post${count !== 1 ? 's' : ''}</span>
      </header>
      <div class="post-rows">
        ${tagPosts.map(item => {
          return `<a href="../posts/${item.slug}/" class="post-row">
          <span class="post-row-title">${escapeHtml(item.title)}</span>
          <time class="post-row-date">${new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
        </a>`;
        }).join("\n        ")}
      </div>
    </section>`;
    }).join("\n")}
    `}
  </main>

  ${getFooterHTML()}

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
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);

    // Tag filtering
    const tagCloud = document.querySelector('.tag-cloud');
    const tagSections = document.querySelectorAll('.tag-section');

    if (tagCloud) {
      tagCloud.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        e.preventDefault();
        const selectedTag = link.dataset.tag;

        // Update active state
        tagCloud.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');

        // Filter sections
        tagSections.forEach(section => {
          if (selectedTag === 'all' || section.dataset.tag === selectedTag) {
            section.style.display = '';
          } else {
            section.style.display = 'none';
          }
        });

        // Scroll to section if specific tag selected
        if (selectedTag !== 'all') {
          const targetSection = document.getElementById(selectedTag);
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }
  </script>
</body>
</html>`;

  await fs.writeFile("site/tags/index.html", html, "utf8");
}

async function writeStaticPage(slug, fallbackTitle, fallbackBody) {
  await fs.mkdir(`site/${slug}`, { recursive: true });

  // Try to read from content/pages/{slug}.md
  let title = fallbackTitle;
  let bodyHtml = fallbackBody;
  try {
    const mdPath = path.join(CONTENT_DIR, 'pages', `${slug}.md`);
    const raw = await fs.readFile(mdPath, 'utf8');
    const parsed = parseFrontmatter(raw);
    title = parsed.frontmatter.title || fallbackTitle;
    bodyHtml = markdownToHtml(parsed.body);
  } catch {
    // Use fallback content
  }

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${getSecurityHeaders()}
  <title>${escapeHtml(title)} - Kol's Korner</title>
  <meta name="description" content="${escapeHtml(title)} - Kol Tregaskes" />
  <link rel="icon" type="image/x-icon" href="../favicon.ico" />
  <link rel="stylesheet" href="../styles.css" />
</head>
<body>
  ${getHeaderHTML('../')}

  <main class="content-main">
    <article class="about-content">
      <div class="about-body">
        ${bodyHtml}
      </div>
    </article>
  </main>

  ${getFooterHTML()}

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

  await fs.writeFile(`site/${slug}/index.html`, html, "utf8");
}

async function writeAboutPage() {
  await fs.mkdir("site/about", { recursive: true });

  // Social links with icons
  const socialLinks = [
    { name: 'X/Twitter', url: 'https://x.com/koltregaskes', icon: '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>' },
    { name: 'Threads', url: 'https://www.threads.com/@koltregaskes', icon: '<path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.88-.73 2.123-1.149 3.503-1.18 1.016-.023 1.97.092 2.862.345-.034-1.466-.383-2.417-1.25-3.058-.707-.521-1.675-.79-2.878-.8h-.015c-1.124.01-2.038.267-2.716.764l-1.085-1.768c1.02-.749 2.326-1.128 3.887-1.128h.02c3.295.02 5.266 1.88 5.482 5.175.125.084.247.172.364.266 1.378 1.103 2.084 2.605 2.042 4.348-.06 2.467-1.217 4.381-3.255 5.381-1.456.714-3.282 1.075-5.434 1.075z"/>' },
    { name: 'YouTube', url: 'https://www.youtube.com/koltregaskes', icon: '<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>' },
    { name: 'GitHub', url: 'https://github.com/koltregaskes/', icon: '<path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>' },
    { name: 'Mastodon', url: 'https://mastodon.social/@koltregaskes', icon: '<path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.668 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"/>' },
    { name: 'Instagram', url: 'https://www.instagram.com/koltregaskes/', icon: '<rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="none" stroke="currentColor" stroke-width="2"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="currentColor" stroke-width="2"/>' },
    { name: 'TikTok', url: 'https://www.tiktok.com/@koltregaskes', icon: '<path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>' }
  ];

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${getSecurityHeaders()}
  <title>About - Kol's Korner</title>
  <meta name="description" content="About Kol Tregaskes - AI explorer, tech enthusiast, and builder based in the UK" />
  <link rel="icon" type="image/x-icon" href="../favicon.ico" />
  <link rel="stylesheet" href="../styles.css" />
</head>
<body>
  ${getHeaderHTML('../')}

  <main class="content-main">
    <!-- Hero Section -->
    <div class="about-hero">
      <div class="about-avatar">
        <div class="about-avatar-placeholder">K</div>
      </div>
      <h1 class="page-title">Kol Tregaskes</h1>
      <p class="about-intro">I'm a <strong>technology enthusiast</strong> and <strong>AI explorer</strong> based in the UK. I write about AI agents, creative tools, and the intersection of technology and daily life. This is my corner of the internet for sharing thoughts, experiments, and discoveries.</p>
    </div>

    <!-- Content Sections -->
    <div class="about-sections">
      <section class="about-section">
        <h2><span class="hash">#</span> What I'm Working On</h2>
        <ul>
          <li>Building AI agent workflows with Claude Code, Gemini, and other tools</li>
          <li>Experimenting with multi-agent orchestration</li>
          <li>Creating automated content pipelines</li>
          <li>Exploring the future of human-AI collaboration</li>
        </ul>
      </section>

      <section class="about-section">
        <h2><span class="hash">#</span> Connect</h2>
        <ul class="social-links">
          ${socialLinks.map(link => `
          <li>
            <a href="${link.url}" target="_blank" rel="noopener">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">${link.icon}</svg>
              ${link.name}
            </a>
          </li>`).join('')}
        </ul>
      </section>
    </div>
  </main>

  ${getFooterHTML()}

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
  ${getHeaderHTML('../')}

  <main class="content-main">
    <!-- Hero Section -->
    <div class="subscribe-hero">
      <h1 class="page-title">Stay in the Loop</h1>
      <p class="subscribe-hero-text">Get the latest on AI agents, creative tools, and tech experiments delivered straight to your inbox.</p>
    </div>

    <!-- Benefits -->
    <div class="subscribe-benefits">
      <div class="subscribe-benefit">
        <span class="subscribe-benefit-icon">📬</span>
        <span>Weekly insights</span>
      </div>
      <div class="subscribe-benefit">
        <span class="subscribe-benefit-icon">🚫</span>
        <span>No spam, ever</span>
      </div>
      <div class="subscribe-benefit">
        <span class="subscribe-benefit-icon">🔓</span>
        <span>Unsubscribe anytime</span>
      </div>
    </div>

    <!-- Subscribe Form Card -->
    <div class="subscribe-form-card">
      <h2>Subscribe to the Newsletter</h2>
      <form
        action="https://buttondown.email/api/emails/embed-subscribe/koltregaskes"
        method="post"
        target="popupwindow"
        onsubmit="window.open('https://buttondown.email/koltregaskes', 'popupwindow')"
      >
        <input type="email" name="email" id="bd-email" placeholder="your@email.com" required />
        <button type="submit">Subscribe</button>
      </form>
    </div>

    <!-- RSS Alternative -->
    <div class="subscribe-rss">
      <h3>Prefer RSS?</h3>
      <p>Subscribe via your favourite feed reader instead.</p>
      <a href="../feed.xml" class="rss-link">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36m0-12.64a14.18 14.18 0 0 1 14.18 14.18h-3.64a10.55 10.55 0 0 0-10.54-10.55V3m0 5.09a9.09 9.09 0 0 1 9.09 9.09H11.64a5.45 5.45 0 0 0-5.46-5.45V8.09z"/>
        </svg>
        RSS Feed
      </a>
    </div>
  </main>

  ${getFooterHTML()}

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

  await fs.writeFile("site/subscribe/index.html", html, "utf8");
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
      // Check if this is a digest post (slug starts with 'daily-digest-')
      const isDigest = item.slug.startsWith('daily-digest-');

      let result;
      if (isDigest) {
        result = await writeDigestPage({
          title: item.title,
          slug: item.slug,
          contentHtml: item.contentHtml,
          tags: item.tags,
          date: item.date,
          readingTime: item.readingTime
        });
      } else {
        result = await writeArticlePage({
          title: item.title,
          slug: item.slug,
          contentHtml: item.contentHtml,
          tags: item.tags,
          date: item.date,
          headings: item.headings,
          readingTime: item.readingTime
        });
      }
      item.localPath = result.localPath;
    }
  }

  // Write all pages
  await writeHomePage(items);
  await writePostsPage(items);
  await writeTagsPage(items);
  await writeAboutPage();
  await writeSubscribePage();
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
  console.log(`✓ RSS feed: site/feed.xml`);
  console.log(`✓ JSON data: site/data/content.json`);
  console.log('\nBuild complete!');
})();
