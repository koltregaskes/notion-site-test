# Troubleshooting Guide

Common issues and solutions for Kol's Korner.

## Table of Contents

- [Build Failures](#build-failures)
- [Content Issues](#content-issues)
- [Display Problems](#display-problems)
- [Performance Issues](#performance-issues)
- [Local Development](#local-development)

## Build Failures

### GitHub Action Fails

**Symptoms**: Red X on commit, build doesn't complete

**Check**:
1. Go to **Actions** tab in GitHub
2. Click the failed workflow
3. Expand the failed step
4. Read the error message

**Common Causes**:

#### "Notion API error 401"
- **Problem**: Invalid or missing NOTION_TOKEN
- **Solution**:
  1. Go to Settings → Secrets → Actions
  2. Verify NOTION_TOKEN is set correctly
  3. Token should start with `secret_`
  4. No extra spaces before/after

#### "Notion API error 404"
- **Problem**: Database not found or not shared
- **Solution**:
  1. Check NOTION_DATABASE_ID is correct (32 characters)
  2. Share database with your integration (Connections menu)
  3. Database ID doesn't include `?v=` part from URL

#### "No published items found"
- **Problem**: All posts have Publish unchecked
- **Solution**: Toggle Publish ON for at least one item

#### "TypeError: Cannot read property..."
- **Problem**: Missing required property in Notion
- **Solution**:
  1. Ensure all items have "Name" (title)
  2. Check "Kind" property exists and has valid options
  3. Verify property names match exactly (case-sensitive)

### Build Times Out

**Symptoms**: Build takes > 10 minutes and fails

**Causes**:
- Too many items in database (rare, would need 1000+)
- Network issues with Notion API

**Solutions**:
1. Re-run the workflow (may be temporary)
2. Check Notion API status page
3. If persistent, contact support

## Content Issues

### Post Not Showing on Site

**Checklist**:
- [ ] Publish checkbox is ✅ ON
- [ ] Kind is set to "article"
- [ ] Name (title) is not empty
- [ ] Wait for next hourly sync or trigger manually
- [ ] Check browser cache (hard refresh: Ctrl+Shift+R)

**Debug Steps**:
1. Check the build logs - does it say "✓ Generated X items"?
2. Look in `site/data/notion.json` - is your post there?
3. Check `site/posts/` - is there a folder for your post?

### Images/Videos Not Displaying

**For Gallery Items**:
- [ ] Kind set to "image" or "video"
- [ ] File uploaded to "Upload" property
- [ ] File size within Notion limits (5MB free, more on paid)
- [ ] Publish is ON

**For Inline Images in Posts**:
- [ ] Image block in Notion content
- [ ] Image is uploaded (not just linked)
- [ ] Wait for Notion to process the image

**Note**: Google Drive links won't work as they require authentication

### Table Not Rendering

**Check**:
- Table has content
- Table has at least one row
- Header row toggle is set correctly in Notion

**Known Limitation**:
- Very complex table formatting may not translate perfectly
- Simple tables work best

### Hash Symbols Not Red

**Check**:
1. Clear browser cache
2. Verify `styles.css` loaded correctly
3. Check browser console for CSS errors

**CSS Rule**:
```css
.hash {
  color: var(--color-primary);
}
```

### Tags Not Showing

**For Post Pages**:
- Tags should appear at bottom of post
- If missing, check Tags property in Notion

**For Tags Page**:
- Only tags with at least one published post appear
- Wait for build to complete

## Display Problems

### Styling Broken/Missing

**Symptoms**: Plain HTML, no colors, bad layout

**Causes**:
- CSS file not loading
- Wrong base path
- Cache issue

**Solutions**:

1. **Hard Refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

2. **Check CSS Path**:
   - Posts should load from: `/notion-site-test/styles.css`
   - Home should load from: `./styles.css`

3. **Verify File Exists**:
   - Go to: `https://<username>.github.io/notion-site-test/styles.css`
   - Should show CSS code, not 404

4. **Check Browser Console**:
   - F12 → Console tab
   - Look for 404 errors

### Dark/Light Mode Not Working

**Toggle Not Responding**:
1. Check browser console for JavaScript errors
2. Clear localStorage: `localStorage.clear()` in console
3. Hard refresh the page

**Stuck in One Mode**:
1. Click the theme toggle (sun/moon icon in header)
2. Check localStorage: `localStorage.getItem('theme')`
3. Manually set: `localStorage.setItem('theme', 'dark')` or `'light'`

### Modal Not Opening (Gallery)

**Symptoms**: Clicking thumbnail does nothing

**Solutions**:
1. Check browser console for JavaScript errors
2. Ensure JavaScript is enabled
3. Try different browser
4. Check if `fullUrl` exists in the HTML

### TOC Not Highlighting

**Symptoms**: Active section not highlighted in Table of Contents

**This is OK**: The IntersectionObserver might not trigger perfectly on all scrolls

**Force Highlight**: Scroll past a heading to trigger the observer

### Responsive Issues (Mobile)

**Too Wide**:
- Check viewport meta tag exists
- Should be: `<meta name="viewport" content="width=device-width, initial-scale=1">`

**Text Too Small/Large**:
- Check responsive breakpoints kicked in
- Inspect element and verify media queries applied

## Performance Issues

### Slow Page Load

**Causes**:
- Large images
- Many images on one page
- Slow network

**Solutions**:
1. Optimize images before uploading (< 1MB)
2. Use WebP or modern formats
3. Lazy loading is already enabled
4. Consider CDN for images

### Build Takes Forever

**Normal Times**:
- 10 posts: ~30 seconds
- 50 posts: ~1-2 minutes
- 100 posts: ~2-3 minutes

**If Slower**:
- Check number of items being fetched
- Large images slow Notion API
- Network issues

## Local Development

### "NOTION_TOKEN not found"

**Windows PowerShell**:
```powershell
$env:NOTION_TOKEN="secret_..."
$env:NOTION_DATABASE_ID="..."
```

**Mac/Linux**:
```bash
export NOTION_TOKEN="secret_..."
export NOTION_DATABASE_ID="..."
```

**Verify**:
```bash
echo $NOTION_TOKEN  # Mac/Linux
echo $env:NOTION_TOKEN  # Windows PS
```

### "Cannot find module" Error

**Cause**: Node.js version too old

**Solution**:
1. Update Node.js to v18+
2. Verify: `node --version`
3. Download from nodejs.org

### Local Site Looks Different

**Issue**: Paths are different locally vs GitHub Pages

**Local URLs**:
- `http://localhost:8080/notion-site-test/`

**If broken**:
1. Check base path in HTML matches
2. Serve from correct directory: `cd site && npx http-server`
3. Access with full path including `/notion-site-test/`

### "Permission Denied" Errors

**Cause**: File permissions or lock

**Windows**:
```powershell
# Run as Administrator or check antivirus
```

**Mac/Linux**:
```bash
chmod +x scripts/fetch-notion.mjs
```

## Debugging Tips

### Enable Verbose Logging

Edit `fetch-notion.mjs` to add console.log statements:

```javascript
console.log('Fetching page:', page.id);
console.log('Title:', title);
console.log('Kind:', kind);
```

### Check Generated Files

After build, inspect:
- `site/data/notion.json` - Raw data from Notion
- `site/posts/*/index.html` - Generated HTML
- Browser DevTools → Network tab - Loading issues

### Validate HTML

Use https://validator.w3.org/ to check generated HTML

### Check API Response

Test Notion API directly:
```bash
curl -X POST 'https://api.notion.com/v1/databases/YOUR_DB_ID/query' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Notion-Version: 2022-06-28'
```

## Common Mistakes

1. **Forgetting to Toggle Publish** - Most common!
2. **Wrong Database ID** - Copy from URL correctly
3. **Not Sharing with Integration** - Must connect in Notion
4. **Case-Sensitive Property Names** - "kind" ≠ "Kind"
5. **Expecting Instant Updates** - Wait for hourly sync
6. **Using External Image Links** - Upload to Notion instead

## Getting Help

1. **Check Logs**:
   - GitHub Actions logs
   - Browser console
   - Local terminal output

2. **Search Issues**:
   - GitHub repository issues tab
   - Notion API documentation

3. **Create Issue**:
   - Include error message
   - Screenshots
   - What you tried
   - Expected vs actual behavior

## Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Post not showing | Toggle Publish OFF then ON |
| Styles broken | Hard refresh (Ctrl+Shift+R) |
| Build failing | Re-run workflow |
| Modal not working | Check console for errors |
| Old content showing | Clear cache + hard refresh |
| Table not rendering | Simplify table, try fewer columns |

## Still Having Issues?

1. Review [SETUP.md](SETUP.md) - Ensure initial setup correct
2. Check [ARCHITECTURE.md](ARCHITECTURE.md) - Understand how it works
3. Review [USAGE.md](USAGE.md) - Confirm you're using correctly
4. Check [CHANGELOG.md](CHANGELOG.md) - See if it's a known change

## Preventive Measures

1. **Test Locally First** - Before expecting live changes
2. **Use Notion Views** - Separate draft/published content
3. **Keep Backups** - Notion has version history
4. **Monitor Builds** - Watch Actions tab occasionally
5. **Validate Before Publishing** - Check all required fields

---

**Remember**: Most issues are solved by:
1. Hard refresh your browser
2. Wait for the next hourly build
3. Check Publish is toggled ON
4. Verify Notion integration is connected
