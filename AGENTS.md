# Agent Guidelines - Kol's Korner

**Version:** 2.1.0
**Last Updated:** 25 December 2025

This document provides guidelines for AI agents (like Claude, GPT, etc.) working on this repository.

---

## Project Context

**What This Is:**
A personal blog and portfolio site that automatically publishes content from Notion to GitHub Pages. It's a static site generator with zero runtime dependencies.

**Owner's Background:**
The repository owner is **not a coder or very technical**. All explanations must be in simple UK English without jargon. When technical terms are necessary, define them in one short line.

**Owner's Workflow:**
- Writes content in Notion (easy WYSIWYG interface)
- Site builds automatically every hour via GitHub Actions
- No manual maintenance required after setup
- Prefers automation over manual processes

---

## Working Style Requirements

### Communication Style

**Language:**
- Use UK English (colour not color, prioritise not prioritize)
- Simple, plain language - no jargon walls
- If you must use a technical term, define it immediately in one line
- Example: "We'll use an API (a way for programs to talk to each other) to fetch your content"

**Structure Every Response:**
1. **Restate the goal** in 1-3 sentences
2. **List assumptions** you're making
3. **Propose 1-2 approaches** with trade-offs
4. **Pick one** and explain why in plain English
5. **Implement** the chosen approach
6. **Verify** with commands/tests when possible
7. **End with:**
   - Your next actions (clear bullets)
   - Questions (only if truly required)

### Change Management

**Keep Changes Small:**
- No big rewrites unless explicitly requested
- Make changes reviewable (clear before/after)
- Always list files touched and summarise why
- Show what changed with specific line numbers when helpful

**Verification:**
- Run tests, lint, and type checks whenever possible
- Show exact commands you ran and key output
- If you can't run them, provide copy-paste commands for the owner
- Prefer Windows-friendly commands (PowerShell, not bash)
- Always include `cd` to correct folder before running project commands

**Error Handling:**
- If errors aren't fixed after 2-3 attempts, STOP
- Rethink the approach or roll back
- Try an alternative method
- Never loop endlessly trying the same fix

---

## Documentation Requirements

### Must-Maintain Files

These files are **critical** and must be kept up-to-date:

1. **ARCHITECTURE.md** - Explain technical stuff here (dummy-proof)
2. **CHANGELOG.md** - Track changes with dates and versioning
3. **README.md** - General project doc with "How To Get Started"
4. **SETUP.md** - How the project is set up
5. **TROUBLESHOOTING.md** - Advice for common issues
6. **USAGE.md** - How to use features
7. **TODO.md** - Task list with emoji status icons, keep history
8. **COSTS.md** - API costs, rate limits, estimates, workarounds
9. **ACCESSIBILITY.md** - Accessibility standard (WCAG 2.2 AA) and testing
10. **llms.txt** - Long-form onboarding for AI tools (this helps you!)
11. **AGENTS.md** - This file

**When to Update:**
- CHANGELOG.md - Every feature/fix
- TODO.md - Every task started/completed
- README.md - When setup process changes
- COSTS.md - When adding paid services or APIs
- Others - When relevant changes occur

### Documentation Standards

**README.md "How To Get Started" Must Include:**
- What to install locally (with download links)
- What tokens/secrets are needed, where to get them (with links), where to put them
- Exact commands to run the project and tests
- Where to access it when live (URL) if cloud-based
- Write it **dummy-proof**

**Code Comments:**
- Add clear, easy-to-read commentary in code
- Explain **why** not **what** (the code shows what)
- Use full sentences, not abbreviations

---

## Security Rules

**Secrets and Tokens:**
- NEVER commit secrets or tokens to git
- Use environment variables exclusively
- Provide .env.example (never .env)
- Keep secrets out of logs and error messages
- Document required secrets in README.md with links to obtain them

**API Keys:**
- Use least-privilege keys (minimum permissions needed)
- Document which permissions are required and why
- Call out security risks when you spot them

**Current Secrets:**
- `NOTION_TOKEN` - Notion API integration token
- `NOTION_DATABASE_ID` - Notion database identifier

**Future Secrets (Not Yet Used):**
- `ANTHROPIC_API_KEY` - For AI-generated summaries
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, etc. - For newsletter automation

---

## Efficiency and Cost Rules

**Prefer Simple Solutions:**
- Simple, proven solutions over complex ones
- Minimal dependencies (currently zero npm packages!)
- Native Node.js modules when possible

**API and Service Suggestions:**
When suggesting APIs or paid services:
1. **Include limits:** Rate limits, quotas, monthly caps
2. **Include costs:** Free tier, paid tiers, per-request pricing
3. **Include workarounds:** Caching, batching, alternatives
4. **Update COSTS.md** with full breakdown

**Example Cost Breakdown Format:**
```markdown
### Claude API (Haiku Model)
- **Pricing:** $0.80 per million input tokens, $4.00 per million output tokens
- **Rate Limit:** 50 requests/minute (free tier)
- **Estimated Usage:** 20 articles/month × ~3,000 tokens = ~60,000 tokens/month
- **Estimated Cost:** $0.06/month
- **Workarounds:**
  - Only generate summaries for articles without manual ones
  - Cache summaries in build to avoid regeneration
  - Use Haiku (cheapest) not Sonnet/Opus
```

**Reduce API Calls:**
- Use caching wherever appropriate
- Batch requests when possible
- Set sensible defaults to minimize calls

---

## UI and Accessibility Rules

### Design Requirements

**Modern and Beautiful:**
- UI must feel like 2026 (modern, clean, fast)
- Easy to use and understand
- Clear visual hierarchy
- Smooth animations and transitions

**Current Design:**
- Perplexity-inspired design system
- Dark mode with theme toggle
- 4-column responsive grid (4 → 2 → 1)
- Red accent colour (#ef4444)

### Accessibility Standard

**Target: WCAG 2.2 AA** (latest standard)

**Must Have:**
- Keyboard navigation (tab order, focus indicators)
- Visible focus states (not just outline: none)
- Semantic HTML first (not div soup)
- Labelled inputs and form controls
- Accessible validation and error messages
- Sensible alt text for images
- Good colour contrast (4.5:1 for text, 3:1 for large text)
- Follow WAI-ARIA Authoring Practices for interactive components

**Current Accessibility Features:**
- Semantic HTML structure (header, nav, main, article)
- Keyboard navigation for gallery modal (arrow keys, ESC)
- Accessible modal with proper ARIA labels
- Form labels and input associations
- Alt text on all images

**Testing:**
When making UI changes:
1. Test keyboard navigation (tab through everything)
2. Check focus indicators are visible
3. Verify colour contrast (use browser dev tools)
4. Test with screen reader if possible (NVDA/JAWS on Windows)
5. Update ACCESSIBILITY.md with any changes

**Automated Checks:**
Suggest simple automated accessibility checks where reasonable:
- axe DevTools browser extension
- Lighthouse accessibility audit (built into Chrome)
- pa11y CLI tool

---

## Automation-First Approach

**Always Look for Automation:**
- CI/CD checks (GitHub Actions)
- Scheduled jobs (hourly builds)
- Scripts to replace manual tasks
- The owner doesn't have time for manual maintenance

**Current Automation:**
- Hourly builds from Notion to GitHub Pages
- Automatic deployment via GitHub Actions
- No manual intervention needed after setup

**When Adding Features:**
Ask yourself: "Can this be automated?"
- If yes → automate it
- If no → document manual steps clearly

**APIs Are Welcome:**
The owner is happy to use APIs, especially if they replace a subscription they already pay for. Just document costs in COSTS.md.

---

## Code Standards

### File Structure

**Main Build Script:**
- `scripts/fetch-notion.mjs` - Does everything
- ~1,200 lines (big but necessary)
- Pure Node.js, no npm packages

**Styling:**
- `site/styles.css` - All CSS in one file
- ~1,400 lines
- Uses CSS custom properties (design tokens)

**Generated Files:**
- `site/` folder - Never edit directly
- All HTML generated by build script
- Overwritten on every build

### Code Style

**JavaScript:**
- Use modern ES6+ features (arrow functions, const/let, template literals)
- Async/await for API calls
- Clear function names that describe what they do
- Add comments explaining **why** not **what**

**CSS:**
- Use CSS custom properties for design tokens
- Mobile-first responsive design
- Clear class names (BEM-style: `.content-card__title`)

**HTML:**
- Semantic HTML first (header, nav, main, article, footer)
- Accessibility attributes (ARIA labels when needed)
- No inline styles (except generated content)

---

## Common Pitfalls to Avoid

**Don't:**
- ❌ Edit files in `site/` folder directly (they're generated)
- ❌ Commit secrets or API keys
- ❌ Add npm dependencies without good reason (currently zero!)
- ❌ Make big rewrites without asking first
- ❌ Use technical jargon without defining it
- ❌ Loop on the same error more than 3 times
- ❌ Forget to update CHANGELOG.md and TODO.md

**Do:**
- ✅ Keep changes small and reviewable
- ✅ Update documentation with every change
- ✅ Verify changes with actual commands/tests
- ✅ Explain everything in plain UK English
- ✅ Show before/after comparisons
- ✅ Include exact commands to run (with `cd` to correct folder)
- ✅ Call out costs and rate limits for new services

---

## Version Control

**Git Workflow:**
- Main branch: `main` (production)
- No feature branches currently (simple project)
- Commit messages should be clear and descriptive

**Good Commit Message Example:**
```
Sprint 2: Gallery modal navigation enhancements

- Added prev/next circular navigation buttons
- Implemented keyboard shortcuts (Arrow Left/Right, ESC)
- Added mouse wheel navigation support
- Circular navigation loops from last to first item
- Modern button design with hover effects
- Mobile responsive navigation buttons

Version 2.1.0 (Sprint 2)
```

**When to Commit:**
- After completing a feature
- After fixing a bug
- Before trying a risky change (easy rollback)
- With updated documentation

---

## Testing Guidelines

**Manual Testing Required:**
Every change should be tested locally before committing:

```powershell
# Windows (PowerShell)
cd "e:\My Drive\Coding\My Github\notion-site-test"
$env:NOTION_TOKEN="secret_xxx"
$env:NOTION_DATABASE_ID="xxx"
node scripts/fetch-notion.mjs
cd site
npx http-server -p 8080
# Visit: http://localhost:8080/notion-site-test/
```

**What to Test:**
- Home page loads without errors
- Content grid displays all items
- Filters work (toggle Articles/Images/Videos/Music)
- Gallery modal opens and navigation works (prev/next, keyboard, mouse wheel)
- Mobile responsive layout (resize browser window)
- All navigation links work
- No console errors in browser dev tools

**Accessibility Testing:**
- Tab through all interactive elements
- Check focus indicators are visible
- Test keyboard shortcuts (Arrow keys, ESC in modal)
- Verify colour contrast with browser dev tools

---

## Current Project Status (v2.1.0)

**Completed:**
- ✅ Sprint 1: Home page redesign with content grid and filters
- ✅ Sprint 1: Music support as new Kind option
- ✅ Sprint 1: Security headers (CSP, XSS protection, etc.)
- ✅ Sprint 1: Gallery protection (right-click blocking)
- ✅ Sprint 1: Newsletter page with preferences
- ✅ Sprint 2: Gallery modal navigation (prev/next, keyboard, mouse wheel)

**Next Up:**
- Sprint 3: Music player features (HTML5 audio, visualizer)
- Sprint 4: Persistent music player (sidebar, playlist)
- Sprint 5: AI-generated summaries (Claude API)
- Sprint 6: Newsletter automation (X/Twitter API)

For complete status, see: [CURRENT-STATUS.md](CURRENT-STATUS.md)
For task list, see: [TODO.md](TODO.md)

---

## Quick Reference

**Build Site:**
```powershell
cd "e:\My Drive\Coding\My Github\notion-site-test"
node scripts/fetch-notion.mjs
```

**Serve Locally:**
```powershell
cd site
npx http-server -p 8080
```

**Key Files to Know:**
- `scripts/fetch-notion.mjs` - Main build script (modify this for features)
- `site/styles.css` - All styling (modify this for design changes)
- `.github/workflows/pages.yml` - CI/CD automation
- `CHANGELOG.md` - Update every release
- `TODO.md` - Track tasks and progress

**Live Site:**
https://koltregaskes.github.io/notion-site-test/

**Required Secrets:**
- NOTION_TOKEN (from https://www.notion.so/my-integrations)
- NOTION_DATABASE_ID (from Notion database URL)

---

## Questions Before You Start?

Before making changes, consider asking:

1. **Is this a big rewrite?** → Ask permission first
2. **Will this add dependencies?** → Justify why it's needed
3. **Will this add costs?** → Document in COSTS.md first
4. **Is the goal clear?** → Restate it in 1-3 sentences
5. **Are there alternatives?** → Propose 1-2 approaches with trade-offs

---

## Response Template

When responding to the repository owner, use this structure:

```markdown
## Goal
[1-3 sentences restating what we're trying to achieve]

## Assumptions
- [List any assumptions you're making]

## Approach
**Option 1:** [Description] - Trade-offs: [...]
**Option 2:** [Description] - Trade-offs: [...]

**I recommend Option X because:** [Plain English explanation]

## Implementation
[What you did, step by step]

## Files Changed
- **file/path.js** (lines X-Y) - [Why you changed it]
- **another/file.css** (lines A-B) - [Why you changed it]

## Verification
```powershell
[Exact commands to run]
```

[Key output or what to look for]

## Next Actions
- [ ] Clear bullet point of what needs to happen next
- [ ] Another action if needed

## Questions (only if required)
- [Only ask if you truly can't proceed without the answer]
```

---

**This document is maintained for AI agents working on this repository. Keep it updated when workflows or standards change.**
