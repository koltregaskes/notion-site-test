# Setup Guide

Complete setup instructions for Kol's Korner static site.

## Prerequisites

- Notion account
- GitHub account
- Node.js 18+ (for local development)

## Step 1: Create Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Name it: `Kol's Korner Site Generator`
4. Select the workspace where your database will live
5. Set capabilities:
   - ✅ Read content
   - ❌ Update content (not needed)
   - ❌ Insert content (not needed)
6. Click **"Submit"**
7. Copy the **Internal Integration Token** (starts with `secret_`)
   - ⚠️ **Save this securely** - you'll need it for GitHub secrets

## Step 2: Create Notion Database

1. Create a new database in Notion (full page)
2. Name it: `Content` (or whatever you prefer)
3. Add the following properties:

### Required Properties

| Property Name | Type | Description |
|--------------|------|-------------|
| **Name** | Title | Post/item title |
| **Kind** | Select | Type: `article`, `image`, `video` |
| **Publish** | Checkbox | Toggle to publish/unpublish |

### Optional Properties

| Property Name | Type | Description |
|--------------|------|-------------|
| **Summary** | Text | Short description (shown on listings) |
| **Tags** | Multi-select | Category tags |
| **Drive URL** | URL | External link (optional for galleries) |
| **Upload** | Files & media | Upload images/videos here |

### Property Setup Details

**Kind (Select)**:
- Add options: `article`, `image`, `video`
- Default: `article`

**Tags (Multi-select)**:
- Add tags as you create posts
- Examples: `tech`, `tutorial`, `personal`, `development`

## Step 3: Share Database with Integration

1. Open your Content database in Notion
2. Click the **"..."** menu (top right)
3. Click **"Connections"**
4. Click **"Connect to"**
5. Find and select your integration: `Kol's Korner Site Generator`
6. Click **"Confirm"**

## Step 4: Get Database ID

1. Open your Content database in Notion
2. Look at the URL in your browser:
   ```
   https://www.notion.so/your-workspace/abc123def456?v=xyz789
   ```
3. The database ID is the part between the last `/` and the `?`:
   ```
   abc123def456
   ```
4. Copy this ID - you'll need it for GitHub secrets

## Step 5: Configure GitHub Repository

### Add Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add two secrets:

**Secret 1: NOTION_TOKEN**
- Name: `NOTION_TOKEN`
- Value: Your integration token from Step 1 (starts with `secret_`)

**Secret 2: NOTION_DATABASE_ID**
- Name: `NOTION_DATABASE_ID`
- Value: Your database ID from Step 4

### Enable GitHub Pages

1. Go to **Settings** → **Pages**
2. Source: **GitHub Actions**
3. The site will be available at: `https://<your-username>.github.io/<repo-name>/`

## Step 6: Add Favicon (Optional)

1. Create a `favicon.ico` file (16x16 or 32x32 pixels)
2. Place it in the `site/` folder
3. Commit and push

The build script will automatically include it in all pages.

## Step 7: Test Locally

### Install Node.js

Download from [nodejs.org](https://nodejs.org/) (v18 or higher)

### Set Environment Variables

**On macOS/Linux:**
```bash
export NOTION_TOKEN="secret_your_token_here"
export NOTION_DATABASE_ID="your_database_id_here"
```

**On Windows (PowerShell):**
```powershell
$env:NOTION_TOKEN="secret_your_token_here"
$env:NOTION_DATABASE_ID="your_database_id_here"
```

### Build the Site

```bash
node scripts/fetch-notion.mjs
```

### Serve Locally

```bash
cd site
npx http-server -p 8080
```

Visit: http://localhost:8080/notion-site-test/

## Step 8: Deploy

### Automatic Deployment

Push any changes to the `main` branch:

```bash
git add .
git commit -m "Update configuration"
git push
```

The site will rebuild automatically.

### Manual Trigger

1. Go to **Actions** tab in GitHub
2. Select **"Build and deploy Pages (Notion -> JSON)"**
3. Click **"Run workflow"**
4. Click **"Run workflow"** button

## Troubleshooting Setup

### "Integration not found" error

- Make sure you shared the database with your integration (Step 3)
- Verify the integration token is correct

### "Database not found" error

- Check that the database ID is correct
- Ensure the database is shared with the integration
- Database ID should be 32 characters (no dashes, no `?v=` part)

### Build fails in GitHub Actions

- Check that secrets are set correctly (no extra spaces)
- View the Actions logs for detailed error messages
- Ensure your Notion database has at least one published item

### No posts showing on site

- Toggle the **Publish** checkbox on in Notion
- Wait for the hourly sync or manually trigger the workflow
- Check that `Kind` is set to `article`

## Next Steps

See [USAGE.md](USAGE.md) for how to:
- Add your first post
- Upload images and videos
- Customize the about page
- Manage tags
