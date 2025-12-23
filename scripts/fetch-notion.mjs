import fs from "node:fs";
import path from "node:path";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

// Use the latest stable version referenced by Notion docs.
// If this changes later, update this one line.
const NOTION_VERSION = process.env.NOTION_VERSION || "2025-09-03";

if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.error("Missing NOTION_TOKEN or NOTION_DATABASE_ID env vars.");
  process.exit(1);
}

const SITE_DIR = path.resolve("site");
const OUT_PATH = path.join(SITE_DIR, "data", "notion.json");

function pickPlainText(rich = []) {
  return Array.isArray(rich) ? rich.map(x => x?.plain_text || "").join("").trim() : "";
}

function getProp(page, name) {
  return page?.properties?.[name];
}

function readTitle(page, name = "Name") {
  const p = getProp(page, name);
  return pickPlainText(p?.title);
}

function readSelect(page, name) {
  const p = getProp(page, name);
  return p?.select?.name || "";
}

function readMultiSelect(page, name) {
  const p = getProp(page, name);
  return Array.isArray(p?.multi_select) ? p.multi_select.map(x => x.name) : [];
}

function readUrl(page, name) {
  const p = getProp(page, name);
  return p?.url || "";
}

function readRichText(page, name) {
  const p = getProp(page, name);
  return pickPlainText(p?.rich_text);
}

function readCheckbox(page, name) {
  const p = getProp(page, name);
  return typeof p?.checkbox === "boolean" ? p.checkbox : null;
}

async function notionFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Notion API ${res.status}: ${txt}`);
  }
  return res.json();
}

// 1) Discover data_source_id from the database container (handles multi-source databases)
async function getFirstDataSourceId(databaseId) {
  const db = await notionFetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "GET"
  });

  const ds = Array.isArray(db?.data_sources) ? db.data_sources : [];
  if (!ds.length) {
    // Fallback: if data_sources is missing, you're likely on an older DB shape.
    // We’ll just treat the databaseId as queryable via legacy endpoint later.
    return null;
  }
  return ds[0].id;
}

// 2) Query either the new data_sources endpoint (preferred) or legacy databases endpoint (fallback)
async function queryAllPages({ databaseId, dataSourceId }) {
  const items = [];
  let cursor = null;

  while (true) {
    const body = {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {})
    };

    // Optional filter: if Publish checkbox exists, we filter for true.
    // Notion will error if the property doesn't exist, so we try once without filter if it fails.
    const filteredBody = {
      ...body,
      filter: { property: "Publish", checkbox: { equals: true } }
    };

    const tryQuery = async (useFilter) => {
      if (dataSourceId) {
        return notionFetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
          method: "POST",
          body: JSON.stringify(useFilter ? filteredBody : body)
        });
      }
      // Legacy fallback (older versions)
      return notionFetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        body: JSON.stringify(useFilter ? filteredBody : body)
      });
    };

    let data;
    try {
      data = await tryQuery(true);
    } catch (e) {
      // likely "property does not exist" for Publish
      data = await tryQuery(false);
    }

    items.push(...(data?.results || []));
    if (!data?.has_more) break;
    cursor = data?.next_cursor;
    if (!cursor) break;
  }

  return items;
}

function normalisePage(page) {
  const title = readTitle(page, "Name");
  const kindRaw = readSelect(page, "Kind").toLowerCase();
  const kind = ["image", "video", "article"].includes(kindRaw) ? kindRaw : "article";

  return {
    id: page.id,
    title: title || "(Untitled)",
    kind,
    url: readUrl(page, "URL"),
    summary: readRichText(page, "Summary"),
    tags: readMultiSelect(page, "Tags"),
    notionUrl: page?.url || ""
  };
}

async function main() {
  const dataSourceId = await getFirstDataSourceId(NOTION_DATABASE_ID);
  const pages = await queryAllPages({ databaseId: NOTION_DATABASE_ID, dataSourceId });

  const items = pages
    .filter(p => p?.object === "page")
    .map(normalisePage)
    .filter(x => x.title);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      { updatedAt: new Date().toISOString(), count: items.length, items },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Wrote ${items.length} items to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
