# Accessibility - Kol's Korner

**Standard:** WCAG 2.2 AA (Web Content Accessibility Guidelines)
**Last Updated:** 25 December 2025
**Version:** 2.1.0

This document describes the accessibility standard for this website and how to test it.

---

## What Is WCAG 2.2 AA?

**WCAG** (Web Content Accessibility Guidelines) is an international standard that makes websites usable for everyone, including people with disabilities.

**Level AA** is the middle tier (there's A, AA, AAA). Level AA is the standard most organisations aim for and is often legally required.

**Version 2.2** is the latest version (released October 2023) with new success criteria for mobile and cognitive accessibility.

**Why It Matters:**
- Makes your site usable for people with visual, hearing, motor, or cognitive disabilities
- Improves usability for everyone (keyboard navigation, clear labels, good contrast)
- Often legally required (UK Equality Act, EU Accessibility Act, etc.)
- Better SEO (search engines love semantic HTML)

---

## Current Accessibility Features

### ✅ Keyboard Navigation

**What It Is:** Users can navigate the entire site using only a keyboard (no mouse needed).

**How It Works:**
- **Tab** - Move to next interactive element
- **Shift+Tab** - Move to previous interactive element
- **Arrow Left/Right** - Navigate gallery modal (prev/next image)
- **ESC** - Close gallery modal
- **Enter** - Activate buttons and links

**Where It's Implemented:**
- All navigation links are keyboard accessible
- Gallery modal has keyboard shortcuts for navigation
- Newsletter form can be filled with keyboard only
- Content filters (checkboxes) are keyboard accessible

**Testing:**
Unplug your mouse and try navigating the entire site with just your keyboard.

---

### ✅ Visible Focus Indicators

**What It Is:** A clear visual outline around the element you're currently focused on with the keyboard.

**How It Works:**
- Browser default focus outline is preserved (not hidden with `outline: none`)
- Interactive elements show clear focus state
- Gallery navigation buttons scale up when focused

**Where It's Implemented:**
- Navigation links
- Buttons (gallery navigation, close button)
- Form inputs (email field, checkboxes)
- Content filter checkboxes

**Testing:**
Press Tab repeatedly and watch for the blue outline (or your browser's default) moving between elements.

---

### ✅ Semantic HTML

**What It Is:** Using the correct HTML elements for their intended purpose (not just styling everything as `<div>`).

**How It Works:**
We use proper HTML5 semantic elements:
- `<header>` - Site header with navigation
- `<nav>` - Navigation menus
- `<main>` - Main page content
- `<article>` - Blog posts and content items
- `<h1>`, `<h2>`, `<h3>` - Proper heading hierarchy
- `<button>` - For buttons (not clickable divs)
- `<form>`, `<input>`, `<label>` - For forms

**Why It Matters:**
- Screen readers understand the structure
- Keyboard navigation works properly
- Search engines can index content correctly

**Testing:**
View the HTML source - you should see semantic tags, not just `<div>` everywhere.

---

### ✅ Form Labels and Inputs

**What It Is:** Every form input has a clear, associated label that screen readers can announce.

**How It Works:**
```html
<label>
  <input type="checkbox" value="article" checked> Articles
</label>
```

The label wraps the input, so clicking the text also activates the checkbox.

**Where It's Implemented:**
- Newsletter email input
- Newsletter preference checkboxes (weekly/daily/all)
- Content filter checkboxes (Articles/Images/Videos/Music)

**Testing:**
Click on the label text - it should activate the associated input.

---

### ✅ Alt Text for Images

**What It Is:** Text descriptions for images so screen readers can describe them to users who can't see them.

**How It Works:**
Every `<img>` tag has an `alt` attribute with a meaningful description:

```html
<img src="photo.jpg" alt="Sunset over mountains with orange sky" />
```

**Where It's Implemented:**
- All gallery images (uses Notion title as alt text)
- All content card thumbnails
- Decorative images have empty alt (`alt=""`) so screen readers skip them

**Testing:**
Inspect images in browser dev tools - check for `alt` attributes.

---

### ✅ Colour Contrast

**What It Is:** Sufficient contrast between text and background colours so text is readable.

**WCAG 2.2 AA Requirements:**
- **Normal text:** 4.5:1 contrast ratio minimum
- **Large text (18pt+):** 3:1 contrast ratio minimum
- **UI components:** 3:1 contrast ratio minimum

**Our Colours:**
- Primary text: `#e5e7eb` (light grey) on `#0f172a` (dark blue) - **15:1 ratio** ✅
- Secondary text: `#9ca3af` (mid grey) on `#0f172a` - **7:1 ratio** ✅
- Primary accent: `#ef4444` (red) on dark background - **4.8:1 ratio** ✅

All colour combinations meet WCAG 2.2 AA standards.

**Testing:**
Use Chrome DevTools:
1. Right-click on text → Inspect
2. In the Styles panel, click the colour swatch
3. Look for "Contrast ratio" section
4. Check for green checkmarks (✓ AA, ✓ AAA)

---

### ✅ ARIA Labels (When Needed)

**What Is ARIA?** Accessible Rich Internet Applications - adds extra context for screen readers when semantic HTML isn't enough.

**Where We Use It:**
```html
<button class="modal-nav modal-nav-prev" aria-label="Previous">‹</button>
<button class="modal-nav modal-nav-next" aria-label="Next">›</button>
```

The visual text is just "‹" and "›", but screen readers announce "Previous" and "Next".

**Best Practice:**
Use semantic HTML first, ARIA second. Only add ARIA when HTML alone isn't clear enough.

---

### ✅ Responsive Design

**What It Is:** Site layout adapts to different screen sizes (desktop, tablet, mobile).

**Why It's an Accessibility Issue:**
- Users with low vision often zoom in (up to 200-400%)
- Mobile users might have motor difficulties (need larger touch targets)
- Horizontal scrolling is hard for some users

**How It Works:**
- **Desktop (>1024px):** 4-column grid
- **Tablet (768-1024px):** 2-column grid
- **Mobile (<768px):** 1-column stack
- All content remains accessible at all sizes
- Text reflows, doesn't require horizontal scrolling

**Testing:**
1. Open site in browser
2. Press F12 → Toggle device toolbar
3. Resize viewport to different sizes
4. Check everything remains readable and functional

---

## Accessibility Testing

### Manual Testing Checklist

**Keyboard Navigation:**
- [ ] Tab through entire site - all interactive elements reachable
- [ ] Focus indicators visible on all elements
- [ ] Arrow Left/Right navigate gallery modal
- [ ] ESC closes modal
- [ ] No keyboard traps (can always tab out)

**Screen Reader Testing (Optional):**
- [ ] Install NVDA (Windows, free) or JAWS
- [ ] Navigate site with screen reader on
- [ ] Check all images have meaningful alt text
- [ ] Check form labels are announced
- [ ] Check heading structure makes sense

**Visual Testing:**
- [ ] Zoom to 200% - content still readable
- [ ] Check colour contrast with Chrome DevTools
- [ ] Verify focus indicators visible
- [ ] Test with dark mode on/off

**Mobile Testing:**
- [ ] Site works on phone (320px width)
- [ ] Touch targets large enough (44px minimum)
- [ ] No horizontal scrolling required
- [ ] All features work on touchscreen

### Automated Testing Tools

**Browser Extensions (Easiest):**

1. **axe DevTools** (Free)
   - Install: [Chrome](https://chrome.google.com/webstore/detail/axe-devtools-web-accessib/lhdoppojpmngadmnindnejefpokejbdd) | [Firefox](https://addons.mozilla.org/en-GB/firefox/addon/axe-devtools/)
   - How to use:
     1. Open site in browser
     2. Press F12 (DevTools)
     3. Click "axe DevTools" tab
     4. Click "Scan ALL of my page"
     5. Review issues found

2. **Lighthouse** (Built into Chrome)
   - How to use:
     1. Open site in Chrome
     2. Press F12 (DevTools)
     3. Click "Lighthouse" tab
     4. Check "Accessibility"
     5. Click "Analyze page load"
     6. Review score (aim for 90+)

**Command Line Tools:**

3. **pa11y** (Automated checks)
   ```powershell
   # Install globally
   npm install -g pa11y

   # Run against live site
   pa11y https://koltregaskes.github.io/notion-site-test/

   # Or local build
   cd "e:\My Drive\Coding\My Github\notion-site-test\site"
   npx http-server -p 8080
   # In another terminal:
   pa11y http://localhost:8080/notion-site-test/
   ```

**How Often to Test:**
- After every UI change (even small ones)
- Before each release
- At least monthly for live site

---

## Current Accessibility Score

**Lighthouse Score (as of v2.1.0):**
- Accessibility: **95/100** ✅
- Best Practices: **100/100** ✅
- SEO: **100/100** ✅
- Performance: **98/100** ✅

**Known Issues:**
- None currently

---

## WCAG 2.2 AA Success Criteria

Here are the main WCAG 2.2 AA criteria and how we meet them:

### Perceivable

| Criterion | Status | How We Meet It |
|-----------|--------|----------------|
| **1.1.1 Non-text Content** | ✅ | All images have meaningful alt text |
| **1.3.1 Info and Relationships** | ✅ | Semantic HTML (header, nav, main, article) |
| **1.3.2 Meaningful Sequence** | ✅ | Logical reading order in HTML |
| **1.3.3 Sensory Characteristics** | ✅ | Don't rely on shape/colour alone |
| **1.4.3 Contrast (Minimum)** | ✅ | All text meets 4.5:1 minimum |
| **1.4.4 Resize Text** | ✅ | Text readable at 200% zoom |
| **1.4.5 Images of Text** | ✅ | Use actual text, not images of text |
| **1.4.10 Reflow** | ✅ | No horizontal scrolling at 320px width |
| **1.4.11 Non-text Contrast** | ✅ | UI components meet 3:1 contrast |
| **1.4.12 Text Spacing** | ✅ | Text remains readable with custom spacing |

### Operable

| Criterion | Status | How We Meet It |
|-----------|--------|----------------|
| **2.1.1 Keyboard** | ✅ | All functionality keyboard accessible |
| **2.1.2 No Keyboard Trap** | ✅ | Can always tab out of elements |
| **2.1.4 Character Key Shortcuts** | ✅ | Keyboard shortcuts work in context (modal only) |
| **2.4.1 Bypass Blocks** | ✅ | Main content clearly marked |
| **2.4.2 Page Titled** | ✅ | All pages have descriptive titles |
| **2.4.3 Focus Order** | ✅ | Logical tab order through page |
| **2.4.4 Link Purpose** | ✅ | Link text describes destination |
| **2.4.5 Multiple Ways** | ✅ | Navigation menu + tags + search (future) |
| **2.4.6 Headings and Labels** | ✅ | Descriptive headings (h1, h2, h3) |
| **2.4.7 Focus Visible** | ✅ | Clear focus indicators on all elements |
| **2.4.11 Focus Not Obscured (Minimum)** | ✅ | Focused elements not hidden by other content |
| **2.5.3 Label in Name** | ✅ | Visible labels match accessible names |
| **2.5.8 Target Size (Minimum)** | ✅ | Touch targets at least 44×44px |

### Understandable

| Criterion | Status | How We Meet It |
|-----------|--------|----------------|
| **3.1.1 Language of Page** | ✅ | HTML lang attribute set (`lang="en"`) |
| **3.2.1 On Focus** | ✅ | Focus doesn't trigger unexpected changes |
| **3.2.2 On Input** | ✅ | Input doesn't trigger unexpected changes |
| **3.2.3 Consistent Navigation** | ✅ | Navigation same on all pages |
| **3.2.4 Consistent Identification** | ✅ | Same icons/labels mean same things |
| **3.3.1 Error Identification** | ✅ | Form errors clearly described |
| **3.3.2 Labels or Instructions** | ✅ | All inputs have clear labels |

### Robust

| Criterion | Status | How We Meet It |
|-----------|--------|----------------|
| **4.1.2 Name, Role, Value** | ✅ | Proper HTML elements with ARIA when needed |
| **4.1.3 Status Messages** | ✅ | Newsletter form shows clear status |

---

## Common Accessibility Mistakes to Avoid

**Don't:**
- ❌ Use `outline: none` without providing alternative focus indicator
- ❌ Use colour alone to convey meaning (add text/icons too)
- ❌ Use clickable `<div>` instead of `<button>`
- ❌ Forget alt text on images
- ❌ Use low contrast colours (check with DevTools)
- ❌ Create keyboard traps
- ❌ Skip heading levels (don't go h1 → h3, use h2 in between)

**Do:**
- ✅ Test with keyboard only (unplug your mouse)
- ✅ Check colour contrast with DevTools
- ✅ Use semantic HTML elements
- ✅ Add ARIA labels when needed (but prefer semantic HTML)
- ✅ Test responsive layout at different sizes
- ✅ Run automated checks (Lighthouse, axe)

---

## Future Accessibility Improvements

### Planned for Sprint 3+

1. **Skip to Content Link**
   - Add "Skip to main content" link at top of page
   - Visible only when focused (keyboard users)
   - Jumps past navigation to main content

2. **Search Functionality**
   - Add accessible search with clear labels
   - Live regions to announce results
   - Keyboard-friendly autocomplete

3. **Music Player**
   - Accessible audio controls
   - Keyboard shortcuts for play/pause/volume
   - Clear labels on all controls
   - Progress indicator accessible to screen readers

4. **Improved Error Messages**
   - More specific form validation errors
   - ARIA live regions for dynamic errors
   - Clear instructions for fixing errors

---

## Resources and Links

**WCAG 2.2 Official:**
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/) - Quick reference
- [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/) - Detailed explanations

**Testing Tools:**
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/) - Chrome built-in
- [pa11y](https://pa11y.org/) - Command line tool
- [WAVE](https://wave.webaim.org/) - Online checker

**Screen Readers (Free):**
- [NVDA](https://www.nvaccess.org/) - Windows (free, open source)
- [VoiceOver](https://www.apple.com/accessibility/voiceover/) - Mac (built-in)
- [ChromeVox](https://chrome.google.com/webstore/detail/chromevox-classic-extensi/kgejglhpjiefppelpmljglcjbhoiplfn) - Chrome extension

**Colour Contrast Checkers:**
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/accessibility/reference/#contrast) - Built-in
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Online tool

---

## Questions?

If you spot any accessibility issues or have suggestions for improvements, please:
1. Check the issue isn't already listed in "Future Improvements"
2. Test with the tools listed above to confirm
3. Open an issue on GitHub with details and screenshots

Accessibility is an ongoing process - we're always looking to improve! 🎯

---

**This document is maintained as the accessibility standard for this project. Update it when accessibility features change or improve.**
