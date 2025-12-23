/* site/app.js */

const state = {
  items: [],
  filter: "all", // all | image | video | article
};

function getRepoBasePath() {
  // Works for GitHub project pages like /notion-site-test/...
  // and keeps working when you're on /notion-site-test/posts/slug/ too.
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.length ? `/${parts[0]}/` : "/";
}

function joinBase(base, p) {
  // base like "/notion-site-test/"
  // p like "/posts/slug/" or "posts/slug/"
  const clean = (p || "").replace(/^\//, "");
  return `${base}${clean}`;
}

function $(sel) {
  return document.querySelector(sel);
}

function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normaliseKind(kind) {
  const k = (kind || "").toLowerCase().trim();
  if (k === "images") return "image";
  if (k === "videos") return "video";
  if (k === "articles") return "article";
  return k;
}

function setActiveFilterButton(filter) {
  const btns = document.querySelectorAll("[data-filter]");
  btns.forEach((b) => {
    const isActive = b.getAttribute("data-filter") === filter;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getFilteredItems() {
  if (state.filter === "all") return state.items;
  return state.items.filter((it) => normaliseKind(it.kind) === state.filter);
}

function buildOpenUrl(item) {
  const base = getRepoBasePath();
  const kind = normaliseKind(item.kind);

  // 1) Local article page (generated during build)
  if (kind === "article" && item.localPath) {
    return joinBase(base, item.localPath);
  }

  // 2) Drive URL (for images/videos or anything else you want)
  if (item.driveUrl) return item.driveUrl;

  // 3) Fallback to Notion page
  return item.notionUrl || "#";
}

function render() {
  const listEl = $("#list");
  const countEl = $("#count");
  const items = getFilteredItems();

  if (countEl) {
    countEl.textContent = `Showing ${items.length} of ${state.items.length}`;
  }

  if (!listEl) return;

  if (!items.length) {
    listEl.innerHTML = `<p class="muted">No items found.</p>`;
    return;
  }

  listEl.innerHTML = items
    .map((item) => {
      const kind = normaliseKind(item.kind) || "unknown";
      const title = escapeHtml(item.title || "Untitled");
      const summary = escapeHtml(item.summary || "");
      const openUrl = buildOpenUrl(item);

      const tagHtml = Array.isArray(item.tags) && item.tags.length
        ? `<div class="tags">${item.tags
            .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
            .join("")}</div>`
        : "";

      return `
        <div class="card">
          <div class="card-top">
            <span class="pill">${escapeHtml(kind.toUpperCase())}</span>
            <a class="open" href="${openUrl}" target="_self" rel="noopener">Open</a>
          </div>

          <div class="card-title">${title}</div>

          ${summary ? `<div class="card-summary">${summary}</div>` : ""}

          ${tagHtml}
        </div>
      `;
    })
    .join("");
}

function wireFilters() {
  const btns = document.querySelectorAll("[data-filter]");
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.getAttribute("data-filter");
      setActiveFilterButton(state.filter);
      render();
    });
  });
}

async function loadData() {
  // IMPORTANT: use repo base path so this works on GitHub Pages project sites
  const base = getRepoBasePath();
  const jsonUrl = joinBase(base, "data/notion.json");

  const res = await fetch(jsonUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${jsonUrl}: ${res.status}`);
  const data = await res.json();

  state.items = Array.isArray(data.items) ? data.items : [];

  // Sort newest edited first (nice default)
  state.items.sort((a, b) => {
    const at = new Date(a.updatedTime || 0).getTime();
    const bt = new Date(b.updatedTime || 0).getTime();
    return bt - at;
  });
}

(async function init() {
  try {
    wireFilters();
    setActiveFilterButton(state.filter);
    await loadData();
    render();
  } catch (err) {
    console.error(err);
    const listEl = $("#list");
    if (listEl) {
      listEl.innerHTML = `<p class="muted">Error loading data. Check GitHub Actions logs and that notion.json exists.</p>`;
    }
  }
})();
