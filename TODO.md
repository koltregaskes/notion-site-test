# TODO List - Kol's Korner Enhancements

## 🔒 Security
- [ ] Add Content Security Policy (CSP) headers
- [ ] Review and secure GitHub Actions secrets usage
- [ ] Add security headers (X-Frame-Options, etc.)

## 🎵 Music/Audio Features
- [ ] Add 'music' as new Kind option in Notion setup docs
- [ ] Create music gallery page with MP3 player
- [ ] Add music visualizer for audio playback
- [ ] Implement persistent music player in sidebar
- [ ] Add play/pause, repeat, shuffle, volume controls
- [ ] Display currently playing song name
- [ ] Support image thumbnails for music (via Upload property)

## 🖼️ Gallery Enhancements
- [ ] Remove "Save as" download buttons from galleries
- [ ] Block right-click save context menu on gallery images/videos
- [ ] Add prev/next navigation buttons in modal
- [ ] Enable mouse wheel navigation in modal (up/down)
- [ ] Remove caption/title display in opened modal view
- [ ] Implement keyboard navigation (arrow keys, ESC)

## 📰 Newsletter System
- [ ] Research third-party newsletter services (Substack, Buttondown, etc.)
- [ ] Create newsletter page with embedded subscription form
- [ ] Add subscription preference options (weekly/daily/all posts/digest)
- [ ] Set up X/Twitter API integration via GitHub Actions
- [ ] Automate weekly news gathering from X accounts (@koltregaskes, @koltregaskes2, @axylusion)
- [ ] Implement AI-powered newsletter content summarization
- [ ] Create newsletter editor workflow/admin interface
- [ ] Format newsletter with selected media from site

## 🏠 Home Page Redesign
- [ ] Implement grid system for all content types
- [ ] Add multi-select filter for Kind property (articles/images/videos/music)
- [ ] Add hover effects with border highlighting
- [ ] Integrate AI-generated summaries for articles (Claude API)
- [ ] Set up ANTHROPIC_API_KEY in GitHub secrets
- [ ] Update home page layout to match Off by One inspiration

## 🔧 Subscribe Page Fixes
- [ ] Fix 405 error on form submission
- [ ] Integrate with chosen newsletter service API
- [ ] Rename page from "Subscribe" to "Newsletter"
- [ ] Add latest newsletter preview on page
- [ ] Implement functional email collection

## 📋 Admin & Management
- [ ] Enhance admin page with newsletter editor
- [ ] Add draft newsletter preview functionality
- [ ] Add manual newsletter publish trigger
- [ ] Display X/Twitter feed integration status
- [ ] Add summary generation testing interface

## 🤖 AI Integration
- [ ] Add Claude API integration for auto-summaries
- [ ] Implement newsletter content AI summarization
- [ ] Add rate limiting and error handling for API calls
- [ ] Cache generated summaries to avoid regeneration

## 🎨 UI/UX Polish
- [ ] Update navigation to include Music page
- [ ] Ensure consistent styling across all galleries
- [ ] Add loading states for AI-generated content
- [ ] Improve mobile responsiveness for new features

## 📚 Documentation Updates
- [ ] Update SETUP.md with music Kind option
- [ ] Document newsletter workflow in USAGE.md
- [ ] Add API key setup instructions (Twitter, Claude)
- [ ] Update ARCHITECTURE.md with new features
- [ ] Add troubleshooting for newsletter integration
