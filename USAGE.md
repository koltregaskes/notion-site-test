# Usage Guide

Day-to-day usage instructions for managing Kol's Korner.

## Table of Contents

- [Adding a Blog Post](#adding-a-blog-post)
- [Adding Images to Gallery](#adding-images-to-gallery)
- [Adding Videos to Gallery](#adding-videos-to-gallery)
- [Managing Tags](#managing-tags)
- [Updating Content](#updating-content)
- [Unpublishing Content](#unpublishing-content)
- [Customizing Pages](#customizing-pages)

## Adding a Blog Post

1. **Open your Notion database**
2. **Click "New"** to create a new row
3. **Fill in the properties:**
   - **Name**: Your post title
   - **Kind**: Select `article`
   - **Publish**: Toggle ✅ ON
   - **Summary**: Write a short description (2-3 sentences)
   - **Tags**: Add relevant tags (create new ones if needed)

4. **Click into the page** and write your content

5. **Use Notion blocks** as normal:
   - Headers (H1, H2, H3) - automatically get red hash symbols
   - Paragraphs
   - Lists (bulleted, numbered)
   - Code blocks
   - Quotes
   - Images
   - Dividers
   - Tables

6. **Save** - Notion auto-saves

7. **Wait for sync** (hourly at :17) or manually trigger the GitHub Action

### Post Tips

- **H1 = `#` (red)** - Shows as `<h2>` on the site
- **H2 = `##` (red)** - Shows as `<h3>` on the site
- **H3 = `###` (red)** - Shows as `<h4>` on the site
- **Table of Contents** - Auto-generated from headers
- **Reading Time** - Auto-calculated from word count
- **Tags** - Appear at the bottom of the post

## Adding Images to Gallery

1. **Create a new row** in your Notion database
2. **Fill in properties:**
   - **Name**: Image title/caption
   - **Kind**: Select `image`
   - **Publish**: Toggle ✅ ON
   - **Summary**: Optional description
   - **Upload**: Drag and drop your image file here

3. **Save and sync**

### Image Tips

- **Supported formats**: JPG, PNG, GIF
- **First image** in Upload field is used as thumbnail
- **Automatically resized** to fit 4-column grid
- **Click to view** full size in modal
- **"Save as"** button for downloading

### Image Best Practices

- Use descriptive titles
- Keep file sizes reasonable (< 2MB)
- Add summaries for context
- Use relevant tags

## Adding Videos to Gallery

Same process as images:

1. **Create new row**
2. **Properties:**
   - **Name**: Video title
   - **Kind**: Select `video`
   - **Publish**: ✅ ON
   - **Upload**: Drag video file here

### Video Tips

- **Best format**: MP4 for maximum compatibility
- **Size limit**: Check Notion's file size limits
- **Modal player**: Opens in full-screen player with controls
- **Thumbnail**: First frame is used (some browsers)

## Managing Tags

### Adding New Tags

1. **While editing** a post, click the **Tags** field
2. **Type a new tag** name
3. **Click "Create"** or press Enter
4. The tag is now available for all posts

### Tag Best Practices

- **Use lowercase**: Keeps things consistent
- **Be specific**: `react` not `javascript`
- **Limit per post**: 3-5 tags max
- **Reuse tags**: Check existing tags before creating new ones

### Popular Tags

Common tags to use:
- `tech`
- `tutorial`
- `personal`
- `development`
- `design`
- `tools`

## Updating Content

### Edit a Post

1. **Find the row** in Notion
2. **Click into the page**
3. **Make your edits**
4. **Save** (auto-saves)
5. **Wait for sync** or manually trigger

### Update Metadata

- **Title**: Edit the Name field
- **Summary**: Update in the properties
- **Tags**: Add/remove tags
- **Date**: Posts show "Last edited" date from Notion

## Unpublishing Content

To remove something from the site without deleting:

1. **Find the row** in Notion
2. **Toggle Publish** checkbox to ❌ OFF
3. **Wait for sync**

The content remains in Notion but won't appear on the site.

## Customizing Pages

### About Page

The About page content is hardcoded in the build script.

**To edit:**

1. Open `scripts/fetch-notion.mjs`
2. Find the `writeAboutPage()` function (around line 857)
3. Edit the HTML content:
   ```javascript
   <p>Your new content here</p>
   ```
4. Commit and push to deploy

### Subscribe Page

Same process as About page - find `writeSubscribePage()` function.

**Note**: The subscribe form is currently a placeholder and doesn't function.

### Home Page

The intro section is hardcoded in `writeHomePage()`.

**To edit:**

1. Find `writeHomePage()` function
2. Look for the `.home-intro` section
3. Edit the content
4. Commit and push

## Publishing Workflow

### Typical Flow

1. **Draft in Notion** with Publish ❌ OFF
2. **Write and refine** your content
3. **Toggle Publish** to ✅ ON when ready
4. **Site updates** within an hour

### Immediate Publish

Need it live now?

1. **Publish** in Notion
2. **Go to GitHub** → Actions tab
3. **Run workflow** manually
4. **Wait 2-3 minutes** for build

## Content Organization

### Recommended Structure

**In Notion Database:**
- Use **Views** to filter by Kind (articles, images, videos)
- Create a **"Draft"** view where Publish = unchecked
- Sort by **Last edited** to see recent changes

**Tags Hierarchy:**
- **Topic**: `tech`, `personal`, `tutorial`
- **Technology**: `react`, `node`, `python`
- **Type**: `guide`, `tips`, `opinion`

## Sync Schedule

- **Automatic**: Every hour at :17 past the hour
- **Manual**: Run workflow anytime from GitHub Actions
- **On Push**: Automatically when you push to `main` branch

## File Limits

**Notion Limits:**
- Free plan: 5MB per file
- Paid plans: Higher limits

**Recommendations:**
- **Images**: < 2MB
- **Videos**: < 50MB (or use external hosting)
- **Total database**: Monitor Notion workspace usage

## Tips & Tricks

1. **Bulk Publishing**: Select multiple rows → Edit property → Toggle Publish
2. **Scheduling**: Use Notion's date properties to track planned publish dates (doesn't auto-publish, just for organization)
3. **Drafts**: Keep Publish OFF while writing
4. **Preview**: Build locally to see changes before they go live
5. **Backup**: Notion has version history - use it!

## What Gets Published

**Only items with:**
- ✅ Publish checkbox is ON
- Kind is set to `article`, `image`, or `video`
- Name (title) is not empty

**Everything else** is ignored by the build script.

## Common Workflows

### Write a Quick Post

1. New row → Fill basics → Open page
2. Write content → Save
3. Toggle Publish → Done

### Plan Content

1. Create rows with Publish OFF
2. Add titles and summaries
3. Schedule in your calendar
4. Write when ready
5. Publish when done

### Update Old Post

1. Find in Notion
2. Make edits
3. Auto-syncs on next build
4. Check site to verify

## Next Steps

- See [ARCHITECTURE.md](ARCHITECTURE.md) for how the system works
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
- See [CHANGELOG.md](CHANGELOG.md) for what's new
