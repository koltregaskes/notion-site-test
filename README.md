# Kol's Korner

A modern, static blog and portfolio site powered by Notion and GitHub Pages. Write in Notion, publish automatically.

[![Deploy Status](https://github.com/koltregaskes/notion-site-test/actions/workflows/pages.yml/badge.svg)](https://github.com/koltregaskes/notion-site-test/actions)

## ✨ Features

- **✍️ Write in Notion** - Use Notion as your CMS with a familiar interface
- **🚀 Auto-Deploy** - Hourly syncs from Notion to GitHub Pages
- **📱 Responsive Design** - Beautiful on desktop, tablet, and mobile
- **🎨 Modern UI** - Clean design with unified content grid and filters
- **🏠 Smart Home Page** - 4-column grid showing all content with multi-select filters
- **🎵 Music Support** - Upload and display music files with dedicated gallery
- **🖼️ Advanced Galleries** - Modal viewer with prev/next buttons, keyboard shortcuts, mouse wheel navigation
- **🏷️ Tag System** - Organize and browse posts by tags
- **📖 Table of Contents** - Auto-generated TOC with scroll tracking
- **⚡ Performance** - Fast static HTML, no runtime dependencies
- **🎯 SEO Optimized** - Meta tags, Open Graph, Twitter Cards
- **🌙 Dark Mode** - Theme toggle with localStorage persistence
- **#️⃣ Hash Headers** - Red hash symbols before headings
- **📧 Newsletter** - Subscription preferences for weekly, daily, or all posts
- **🔒 Security** - CSP headers, XSS protection, anti-clickjacking, right-click protection

## 🚀 How to Get Started

### Prerequisites

- **Node.js** - Version 18 or higher ([Download here](https://nodejs.org/))
- **Notion Account** - Free account works ([Sign up](https://www.notion.com))
- **GitHub Account** - For hosting and automation ([Sign up](https://github.com))

### Step 1: Set Up Your Notion Database

1. **Create a Notion integration:**
   - Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
   - Click "New integration"
   - Name it (e.g., "Kol's Korner")
   - Copy the **Internal Integration Token** (starts with `secret_`)

2. **Create your content database:**
   - Duplicate this template: [Notion Database Template](SETUP.md#notion-database-structure)
   - Or create new database with these properties:
     - `Name` (Title) - Required
     - `Kind` (Select) - Options: article, image, video, music
     - `Summary` (Text) - Optional description
     - `Tags` (Multi-select) - Categories
     - `Publish` (Checkbox) - Toggle to publish
     - `Upload` (Files) - For images/videos/music files
     - `Drive URL` (URL) - Alternative to Upload

3. **Share database with your integration:**
   - Click "Share" on your database
   - Add your integration by name
   - Copy the **Database ID** from URL: `notion.com/.../{DATABASE_ID}?v=...`

### Step 2: Fork and Configure This Repository

1. **Fork this repository:**
   - Click "Fork" button at top of [this repo](https://github.com/koltregaskes/notion-site-test)
   - Clone your fork locally:
     ```bash
     git clone https://github.com/YOUR_USERNAME/notion-site-test.git
     cd notion-site-test
     ```

2. **Add GitHub secrets:**
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add two secrets:
     - Name: `NOTION_TOKEN`, Value: Your integration token from Step 1.1
     - Name: `NOTION_DATABASE_ID`, Value: Your database ID from Step 1.3

### Step 3: Test Locally (Optional)

1. **Install Node.js** if not already installed ([Download](https://nodejs.org/))

2. **Set environment variables** (PowerShell on Windows):
   ```powershell
   $env:NOTION_TOKEN="secret_your_token_here"
   $env:NOTION_DATABASE_ID="your_database_id_here"
   ```

   Or on Mac/Linux (Terminal):
   ```bash
   export NOTION_TOKEN="secret_your_token_here"
   export NOTION_DATABASE_ID="your_database_id_here"
   ```

3. **Build the site:**
   ```bash
   node scripts/fetch-notion.mjs
   ```

4. **Serve locally:**
   ```bash
   cd site
   npx http-server -p 8080
   ```

5. **Visit:** [http://localhost:8080/notion-site-test/](http://localhost:8080/notion-site-test/)

### Step 4: Deploy to GitHub Pages

1. **Enable GitHub Pages:**
   - Go to your repo → Settings → Pages
   - Source: "GitHub Actions"

2. **Push to trigger deployment:**
   ```bash
   git add .
   git commit -m "Initial setup"
   git push
   ```

3. **Wait for build:**
   - Go to Actions tab
   - Watch the "pages" workflow complete (~1-2 minutes)

4. **Visit your live site:**
   - **Your URL:** `https://YOUR_USERNAME.github.io/notion-site-test/`
   - Or check Settings → Pages for the exact URL

### Step 5: Add Content in Notion

1. **Create rows in your Notion database:**
   - Add `Name` (title of your post/media)
   - Set `Kind` (article, image, video, or music)
   - Write `Summary` (optional)
   - Add `Tags` (optional)
   - **Toggle `Publish` checkbox ON**

2. **Wait for auto-sync:**
   - Site rebuilds automatically **every hour at :17 minutes**
   - Or manually trigger: Actions tab → "pages" workflow → "Run workflow"

3. **See your changes live:**
   - Visit your GitHub Pages URL
   - New content appears after build completes

### Where to Find Your Live Site

Your site will be live at:
- **Default URL:** `https://YOUR_USERNAME.github.io/notion-site-test/`
- **Custom domain:** You can set this up in Settings → Pages → Custom domain

Example: [https://koltregaskes.github.io/notion-site-test/](https://koltregaskes.github.io/notion-site-test/)

---

**Need more details?** See the full documentation:
- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[USAGE.md](USAGE.md)** - How to add different content types
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and fixes

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
