# Kol's Korner

A modern, static blog and portfolio site powered by Notion and GitHub Pages. Write in Notion, publish automatically.

[![Deploy Status](https://github.com/koltregaskes/notion-site-test/actions/workflows/pages.yml/badge.svg)](https://github.com/koltregaskes/notion-site-test/actions)

## ✨ Features

- **✍️ Write in Notion** - Use Notion as your CMS with a familiar interface
- **🚀 Auto-Deploy** - Hourly syncs from Notion to GitHub Pages
- **📱 Responsive Design** - Beautiful on desktop, tablet, and mobile
- **🎨 Modern UI** - Clean design inspired by Off by One
- **🖼️ Galleries** - Image and video galleries with modal viewing
- **🏷️ Tag System** - Organize and browse posts by tags
- **📖 Table of Contents** - Auto-generated TOC with scroll tracking
- **⚡ Performance** - Fast static HTML, no runtime dependencies
- **🎯 SEO Optimized** - Meta tags, Open Graph, Twitter Cards
- **🌙 Dark Mode** - Theme toggle with localStorage persistence
- **#️⃣ Hash Headers** - Red hash symbols before headings

## 🚀 Quick Start

1. **Set up Notion database** - See [SETUP.md](SETUP.md)
2. **Configure GitHub secrets** - Add `NOTION_TOKEN` and `NOTION_DATABASE_ID`
3. **Push to main** - GitHub Actions handles the rest
4. **Posts sync hourly** - Automatic updates every hour at :17

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Initial setup and configuration
- **[USAGE.md](USAGE.md)** - How to add posts, images, and videos
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical details and how it works
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and updates
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and solutions

## 🛠️ Tech Stack

- **CMS**: Notion API
- **Build**: Node.js (native modules only)
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions
- **Design**: Custom CSS with design tokens (Perplexity-inspired)

## 📁 Project Structure

```
notion-site-test/
├── .github/
│   └── workflows/
│       └── pages.yml          # Auto-deploy workflow
├── scripts/
│   └── fetch-notion.mjs       # Build script
├── site/                      # Generated files (do not edit)
│   ├── index.html
│   ├── styles.css
│   ├── posts/
│   ├── images/
│   ├── videos/
│   ├── tags/
│   ├── about/
│   └── subscribe/
└── docs/                      # Documentation
```

## 🎯 Quick Links

- **Live Site**: [https://koltregaskes.github.io/notion-site-test/](https://koltregaskes.github.io/notion-site-test/)
- **GitHub Repo**: [https://github.com/koltregaskes/notion-site-test](https://github.com/koltregaskes/notion-site-test)

## 🔧 Local Development

```bash
# Set environment variables
export NOTION_TOKEN="your_notion_integration_token"
export NOTION_DATABASE_ID="your_database_id"

# Build site
node scripts/fetch-notion.mjs

# Serve locally
cd site
npx http-server -p 8080
```

Visit http://localhost:8080/notion-site-test/

## 📝 License

MIT License - Feel free to fork for your own use!

## 🙏 Credits

- Design inspired by [Off by One](https://justoffbyone.com)
- Built by Kol Tregaskes
