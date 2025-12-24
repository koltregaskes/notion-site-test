# Architecture Documentation

Technical details about how Kol's Korner works.

## System Overview

Kol's Korner is a **static site generator** that uses Notion as a CMS and deploys to GitHub Pages.

```
┌──────────┐      ┌──────────────┐      ┌──────────────┐
│          │      │              │      │              │
│  Notion  │─────▶│ GitHub       │─────▶│ GitHub       │
│ Database │      │ Actions      │      │ Pages        │
│          │      │ (Build)      │      │ (Deploy)     │
└──────────┘      └──────────────┘      └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │              │
                  │ Static HTML  │
                  │ CSS/JS       │
                  │              │
                  └──────────────┘
```

## Data Flow

1. **Content Creation** - Write in Notion
2. **API Fetch** - GitHub Action calls Notion API
3. **HTML Generation** - Node.js script generates static files
4. **Deployment** - GitHub Pages serves the files

## Components

### 1. Notion Database

**Purpose**: Content management system

**Schema**:
```
Content Database
├── Name (Title)
├── Kind (Select: article, image, video)
├── Publish (Checkbox)
├── Summary (Text)
├── Tags (Multi-select)
├── Drive URL (URL)
└── Upload (Files & media)
```

**API Access**:
- Notion Integration with read-only access
- Fetches all items where Publish = true
- Returns pages with properties and content blocks

### 2. Build Script (`scripts/fetch-notion.mjs`)

**Purpose**: Fetch data and generate static site

**Main Functions**:

```javascript
// Fetch all published pages
queryDatabaseAll()
  → Returns array of page objects

// Fetch blocks (content) for a page
fetchBlocksAll(pageId)
  → Returns array of block objects
  → Handles pagination automatically

// Convert blocks to HTML
blocksToHtml(blocks)
  → Async function (fetches table children)
  → Handles: paragraphs, headers, lists, code, images, tables
  → Returns HTML string

// Generate pages
writeArticlePage()    // Individual post pages
writeHomePage()       // Home page with latest posts
writePostsPage()      // All posts listing
writeTagsPage()       // Posts grouped by tag
writeAboutPage()      // Static about page
writeSubscribePage()  // Static subscribe page
writeGalleryPage()    // Image/video galleries
```

**Block Type Support**:

| Notion Block | HTML Output |
|-------------|-------------|
| heading_1 | `<h2>` with hash symbol |
| heading_2 | `<h3>` with hash symbols |
| heading_3 | `<h4>` with hash symbols |
| paragraph | `<p>` |
| bulleted_list | `<ul><li>` |
| numbered_list | `<ol><li>` |
| code | `<pre><code>` |
| quote | `<blockquote>` |
| divider | `<hr>` |
| image | `<figure><img>` |
| table | `<table>` with thead/tbody |

### 3. GitHub Actions (`.github/workflows/pages.yml`)

**Triggers**:
- Push to `main` branch
- Manual workflow dispatch
- Hourly cron: `17 * * * *`

**Steps**:
1. Checkout code
2. Setup Node.js 20
3. Run `node scripts/fetch-notion.mjs`
   - Uses secrets: NOTION_TOKEN, NOTION_DATABASE_ID
4. Configure GitHub Pages
5. Upload `site/` folder as artifact
6. Deploy to GitHub Pages

### 4. Generated Site (`site/` folder)

**Structure**:
```
site/
├── index.html              # Home page
├── styles.css              # Global styles
├── favicon.ico             # Site icon
├── posts/
│   ├── index.html          # Posts listing
│   └── {slug}/
│       └── index.html      # Individual post
├── images/
│   └── index.html          # Image gallery
├── videos/
│   └── index.html          # Video gallery
├── tags/
│   └── index.html          # Tags page
├── about/
│   └── index.html          # About page
├── subscribe/
│   └── index.html          # Subscribe page
└── data/
    └── notion.json         # Raw data (legacy)
```

## Design System

### CSS Architecture

**Design Tokens**:
```css
:root {
  /* Primitive Colors */
  --color-cream-50
  --color-teal-500
  --color-charcoal-700

  /* Semantic Colors */
  --color-background
  --color-surface
  --color-text
  --color-primary

  /* Spacing Scale */
  --space-0 through --space-32

  /* Typography */
  --font-family-sans
  --font-size-xs through --font-size-4xl
  --font-weight-normal through --font-weight-bold
}
```

**Dark/Light Mode**:
- Automatic: `@media (prefers-color-scheme: dark)`
- Manual toggle: `[data-theme="dark"]`
- Persisted in localStorage

**Component Classes**:
- `.site-header` - Top navigation
- `.page-container` - Two-column layout (sidebar + content)
- `.sidebar` - Sticky TOC
- `.toc` - Table of contents
- `.post-content` - Article content
- `.gallery-grid` - 4-column responsive grid
- `.modal` - Full-screen image/video viewer

## Data Processing

### Content Fetching

```javascript
// 1. Query database
const pages = await queryDatabaseAll()

// 2. For each page
for (const page of pages) {
  // Extract properties
  const title = getTitle(page)
  const kind = getSelect(page, "Kind")
  const tags = getMultiSelect(page, "Tags")

  // For articles, fetch content
  if (kind === "article") {
    const blocks = await fetchBlocksAll(page.id)
    const html = await blocksToHtml(blocks)
    await writeArticlePage({ title, html, tags })
  }
}
```

### Table Processing

Tables require special handling:

```javascript
if (block.type === "table") {
  // Fetch table rows as children
  const tableRows = await fetchBlocksAll(block.id)

  // Generate table HTML
  tableRows.forEach((row, idx) => {
    if (idx === 0 && hasHeader) {
      // First row as <thead>
    } else {
      // Other rows as <tbody>
    }
  })
}
```

### Reading Time Calculation

```javascript
const wordCount = contentHtml
  .replace(/<[^>]*>/g, '')      // Strip HTML tags
  .split(/\s+/)                  // Split on whitespace
  .filter(w => w.length > 0)     // Remove empty strings
  .length

const readingTime = Math.max(1, Math.ceil(wordCount / 200))
```

## Performance Optimizations

1. **Static Generation** - Everything pre-rendered
2. **No Runtime Dependencies** - Pure HTML/CSS/JS
3. **Pagination Handling** - Fetches all Notion results
4. **Image Lazy Loading** - `loading="lazy"` on images
5. **CSS Variables** - Efficient theming
6. **Minimal JS** - Only for theme toggle and modal

## Security

1. **No API Keys Exposed** - Secrets in GitHub Actions only
2. **Read-Only Integration** - Notion integration can't write
3. **Static Files Only** - No server-side execution
4. **HTTPS by Default** - GitHub Pages enforces HTTPS

## File Generation Flow

```
queryDatabaseAll()
   ↓
Parse each page
   ↓
For articles:
   fetchBlocksAll(pageId)
   ↓
   blocksToHtml(blocks)
   ↓
   writeArticlePage()

For galleries:
   getFiles(page, "Upload")
   ↓
   writeGalleryPage()

Finally:
   writeHomePage(items)
   writePostsPage(items)
   writeTagsPage(items)
   writeAboutPage()
   writeSubscribePage()
```

## Customization Points

### Adding New Block Types

Edit `blockToHtml()` function:

```javascript
if (t === "new_block_type") {
  return `<custom-html>...</custom-html>`
}
```

### Changing Page Structure

Edit the respective `write*Page()` functions in `fetch-notion.mjs`

### Styling Changes

All styles in `site/styles.css` using CSS variables for easy theming

### Adding New Properties

1. Add property in Notion database
2. Create getter function: `getPropertyType(page, "PropertyName")`
3. Use in page generation functions

## Error Handling

- **API Errors**: Caught and logged, build fails
- **Missing Properties**: Default values used
- **Empty Content**: Skipped or placeholder shown
- **File Limits**: Notion enforces upload limits

## Deployment

**Build Time**: ~30 seconds for 10 posts
**Deploy Time**: ~1-2 minutes total
**Cache**: No caching, fresh build every time

## Limitations

1. **No Search** - Static site, no search index
2. **No Comments** - Would need external service
3. **No Analytics** - Add Google Analytics manually
4. **File Sizes** - Limited by Notion's file upload limits
5. **Build Time** - Grows with content (but still fast)

## Future Enhancements

Possible additions:
- RSS feed generation
- Sitemap.xml
- Search with Algolia/Pagefind
- Comments via Disqus/Giscus
- Analytics integration
- Image optimization
- Incremental builds

## Tech Stack Details

- **Node.js**: v18+ (uses native fetch, fs/promises)
- **Notion API**: Version 2022-06-28
- **GitHub Actions**: Ubuntu latest runner
- **GitHub Pages**: Static hosting
- **No Build Tools**: No webpack, no bundlers
- **No Dependencies**: Uses only Node built-ins

## Code Organization

```
scripts/fetch-notion.mjs
├── Helper functions (top)
│   ├── slugify()
│   ├── getProp()
│   ├── getTitle()
│   ├── getSelect()
│   └── ...
├── API functions
│   ├── queryDatabaseAll()
│   └── fetchBlocksAll()
├── Conversion functions
│   ├── rtToHtml()
│   ├── blockToHtml()
│   ├── blocksToHtml()
│   └── generateTOC()
├── Page generation functions
│   ├── writeArticlePage()
│   ├── writeHomePage()
│   ├── writePostsPage()
│   ├── writeTagsPage()
│   ├── writeAboutPage()
│   ├── writeSubscribePage()
│   └── writeGalleryPage()
└── Main execution (bottom)
    └── IIFE async function
```

## Next Steps

- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for debugging
- See [USAGE.md](USAGE.md) for daily operations
- See [CHANGELOG.md](CHANGELOG.md) for version history
