# Kol's Korner - Personal Blog

**Live:** https://koltregaskes.github.io/notion-site-test/
**Stack:** Custom Node.js static site generator, GitHub Pages

## Build & Deploy

```bash
node scripts/build.mjs    # Build site to site/
git push origin main       # Deploys via GitHub Actions
```

## Key Files

- `scripts/build.mjs` - Build script (markdown → HTML)
- `site/styles.css` - All styling (CSS custom properties)
- `content/` - Blog posts as markdown with YAML frontmatter
- `site/` - Generated output (committed to repo)

## Design Tokens

- **Primary colour:** Red (#dc2626 light, #f87171 dark)
- **Font:** Fira Sans (300/400/600)
- **Base font size:** 17px
- **Line height:** 1.7 for body text

## Content

- Blog posts only (no galleries)
- Navigation: Posts, Tags, About, Newsletter
- Frontmatter: title, date, tags, summary, image, publish
- Posts with `publish: false` are excluded from build

## Conventions

- UK English
- Reusable HTML via `getHeaderHTML(basePath)` and `getFooterHTML()` functions in build.mjs
