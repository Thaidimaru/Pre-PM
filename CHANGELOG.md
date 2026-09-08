# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.3] - 2026-09-08

### Fixed
- Fixed Thai font rendering, text alignment, and diacritic clipping issues across the application.
- Integrated comprehensive Google Fonts (`Noto Sans Thai`, `Prompt`, `Sarabun`, and `Inter`) with full weights in `index.html`.
- Configured font fallback stack and modern typography standards in `src/index.css` (`font-size-adjust: from-font`, `letter-spacing: normal`, `line-break: relaxed`, `text-wrap: pretty`, and line-height `1.6`).
- Fixed text gradient clipping in `ShinyText` component by applying vertical padding, box-decoration-break cloning, and proper line height.
- Resolved Thai character spacing and tone mark distortion by replacing `tracking-tight` and `tracking-wide` with `tracking-normal leading-normal` on all Thai headings, cards, and buttons.

## [2.0.2] - 2026-09-08

### Fixed
- Fixed 404 error when loading `nbtc-logo-dashboard.png` by configuring the `public/` directory with static assets and importing the image module directly in `Navbar` and `LoginView`.

## [2.0.1] - 2026-09-08

### Changed
- Modernized frontend architecture to Single Page Application (SPA) powered by React 18, Vite 5, Tailwind CSS 4, and Radix UI accessible primitives.
- Upgraded UI styling to responsive Dark Cyber Glassmorphism theme with Framer Motion animations and Lucide React icons.
- Centralized application version management with authoritative single source of truth (`src/version.js`).
- Added standalone utility script `export_photos.py` to extract SQLite survey photos into local storage.
- Updated `database.py`, `netlify.toml`, and `vercel.json` with client-side SPA routing fallbacks and build artifact integration.

## [1.0.0] - 2026-09-08

### Added
- **Survey Control Room Dashboard**:
  - Live statistics display (total surveys, database stations, access granted / denied).
  - Provincial distribution bar chart with real-time station count.
  - Recent survey activity log table with auto-polling every 30 seconds.
  - Modern Glassmorphism aesthetic theme (`dashboard-theme.css`) with spotlight and shine effects.
- **Field Visit / Site Record Form**:
  - 7 structured sections covering Station Info, Local Informant, Site Access Permit, Radio & Power Status, Site Environment, Photo Documentation, and Sign-off Confirmation.
  - Real-time station search autocomplete connected to `DATABASE.xlsx`.
  - Multi-photo upload support with client-side preview and payload optimization.
- **Dual Server Architecture**:
  - **Cloud Serverless**: Netlify Functions (`netlify/functions/api.js`) with Netlify Blobs storage and Vercel serverless integration (`api/handler.js`).
  - **Local / Standalone**: Python threaded HTTP server (`database.py`) with SQLite backend (`survey.db`) and automated startup script (`server.ps1`).
- **Security & Access Control**:
  - Token-based HMAC SHA-256 authentication with configurable password via environment variables (`FORM_PASSWORD`) or `access-password.txt`.
  - URL rewrites preventing direct access to sensitive data files (`DATABASE.xlsx`, `access-password.txt`, `survey.db`).
- **Data Exporting**:
  - Automated PowerShell script (`export-surveys.ps1`) for exporting survey records into structured Excel sheets (`SURVEY_DATA.xlsx`).
