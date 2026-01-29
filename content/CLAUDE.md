# Content Folder

This folder contains all site content as Obsidian-compatible markdown files.

## Frontmatter Format

```yaml
---
title: Your Post Title
date: 2026-01-01
tags: [tag1, tag2]
summary: Brief description for previews
image: images/hero.jpg  # Optional, for thumbnails
publish: true  # Set to false to hide
---
```

## File Organisation

```
content/
  welcome.md           # Article
  my-predictions.md    # Article
  pages/               # Static pages (about, uses, now)
  images/              # Image files for posts
```

## Building

Run `node scripts/build.mjs` to generate the site from these files.
