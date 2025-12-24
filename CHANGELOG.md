# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-12-24

### Added
- **Complete Design System Overhaul**
  - Implemented Perplexity-inspired design system with comprehensive design tokens
  - Added dark/light mode support with manual theme toggle and localStorage persistence
  - New color system with semantic tokens for better theming
  - Typography system with FK Grotesk Neue font and fallback stack
  - Systematic spacing scale (--space-0 to --space-32)

- **Gallery Features**
  - Image and video galleries with 4x2 grid layout (8 latest items)
  - Clickable thumbnails that open full-size in modal viewer
  - "Save as" download buttons for all media
  - Support for "Upload" property in Notion for easy media management
  - Responsive grid (4 columns desktop, 2 tablet, 1 mobile)

- **Content Enhancements**
  - Red hash symbols (# ## ###) before h1, h2, h3 headings
  - Tags moved to bottom of post pages
  - Table rendering support with proper thead/tbody structure
  - Improved reading time calculation (strips HTML, filters empty words)

- **UI Improvements**
  - Hidden TOC scrollbars while maintaining auto-scroll
  - Tightened TOC line spacing for cleaner look
  - Modal viewer for images and videos with backdrop click to close
  - Smooth transitions and hover effects throughout

- **SEO & Meta**
  - Comprehensive meta tags for all pages
  - Open Graph tags for social sharing
  - Twitter Card support
  - Favicon support added to all pages
  - Page titles now include "- Kol's Korner" suffix
  - Auto-generated descriptions from content

- **Documentation**
  - Comprehensive README with feature list and quick links
  - CHANGELOG for version tracking
  - SETUP guide for initial configuration
  - USAGE guide for day-to-day operations
  - ARCHITECTURE documentation for technical details
  - TROUBLESHOOTING guide for common issues

### Changed
- Reading time now calculated from actual content word count, not summary
- All page titles now consistently formatted with site name
- Gallery items sorted by latest first (updatedTime)
- Improved responsive breakpoints for better mobile experience

### Fixed
- Table rendering now works correctly by fetching table row children
- Reading time on home page and posts page now matches individual posts
- TOC spacing inconsistencies resolved
- Hash symbols properly styled with primary color

## [1.0.0] - 2024-XX-XX

### Added
- Initial project setup with Notion API integration
- GitHub Actions workflow for hourly auto-deployment
- Basic homepage with hero section and latest posts
- Posts page with full article list
- Tags page for browsing by category
- Individual post pages with table of contents
- About page
- Subscribe page (placeholder)
- Basic responsive design
- Dark theme

### Features
- Fetch content from Notion database
- Generate static HTML pages
- Deploy to GitHub Pages automatically
- Support for articles, images, and videos
- Tag-based organization
- Reading time estimation

---

## Version Format

- **Major.Minor.Patch**
- **Major**: Breaking changes or major feature additions
- **Minor**: New features, backwards compatible
- **Patch**: Bug fixes and minor improvements
