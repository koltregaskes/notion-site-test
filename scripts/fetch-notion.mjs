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

  if (t === "heading_1") return `<h1>${rtToHtml(block.heading_1?.rich_text || [])}</h1>`;
  if (t === "heading_2") return `<h2>${rtToHtml(block.heading_2?.rich_text || [])}</h2>`;
  if (t === "heading_3") return `<h3>${rtToHtml(block.heading_3?.rich_text || [])}</h3>`;

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

  // If you paste images into the Notion page body, this will at least render the image URL
  if (t === "image") {
    const src = block.image?.file?.url || block.image?.external?.url || "";
    const cap = rtToHtml(block.image?.caption || []);
    if (!src) return "";
    return `<figure><img src="${escapeHtml(src)}" alt="" loading="lazy" />${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
  }

  // fallback: ignore unknown block types for now
  return "";
}

function blocksToHtml(blocks) {
  // handle basic list grouping
  let html = "";
  let inBullets = false;
  let inNumbers = false;

  for (const b of blocks) {
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

async function writeArticlePage({ title, slug, contentHtml }) {
  const outDir = path.join("site", "posts", slug);
  await fs.mkdir(outDir, { recursive: true });

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/notion-site-test/styles.css" />
</head>
<body>
  <div class="wrap">
    <p><a href="/notion-site-test/">← Back</a></p>
    <h1>${escapeHtml(title)}</h1>
    <article class="article">
      ${contentHtml}
    </article>
  </div>
</body>
</html>`;

  await fs.writeFile(path.join(outDir, "index.html"), html, "utf8");
  return `/posts/${slug}/`;
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

    if (kind === "article") {
      const blocks = await fetchBlocksAll(page.id);
      const contentHtml = blocksToHtml(blocks);
      localPath = await writeArticlePage({ title, slug, contentHtml });
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
      localPath, // for articles: /posts/<slug>/
      updatedTime: page.last_edited_time,
    });
  }

  await fs.mkdir("site/data", { recursive: true });
  await fs.writeFile("site/data/notion.json", JSON.stringify({ items }, null, 2), "utf8");

  console.log(`Wrote ${items.length} items to site/data/notion.json`);
})();
