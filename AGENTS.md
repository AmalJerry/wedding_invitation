# AGENTS.md

## What this is
A static, configurable wedding invitation site. No framework and no build step: Netlify publishes `public/` as-is (see `netlify.toml`).

## Layout
- `public/config.js` — the **only** file non-developers should need to edit. Defines `window.WEDDING_CONFIG` (couple, dates, events, venue, photos, RSVP, music, theme).
- `public/index.html` — section skeleton. Text slots use `data-*` attributes (e.g. `data-groom`, `data-long-date`) that `app.js` fills from config.
- `public/app.js` — one IIFE that renders everything: envelope intro, scratch-to-reveal canvas, countdown, carousel, events, venue map, moments grid, lightbox, WhatsApp/calendar links, dock scroll-spy and falling petals.
- `public/styles.css` — all styling; theme colours are CSS variables (`--gold`, `--deep`, `--paper`) overridden from `config.theme`.
- `public/images/` — photos. Shipped images are AI-generated placeholders meant to be replaced with the couple's photos.

## Conventions / decisions
- Keep it dependency-free vanilla JS so it stays editable by anyone.
- Any new content must be driven from `config.js`; never hard-code couple-specific text in HTML/JS. Empty strings / empty arrays hide the related element or section (and its dock link).
- Images are served through `/.netlify/images?url=...&w=...&fm=webp` via the `setImg` helper, with `onerror` fallback to the original file so the page also works outside Netlify.
- Dates are ISO strings with offset; display uses `Intl` in `config.timeZone` (default `Asia/Kolkata`).
- The `?to=Name` query param personalises the envelope and the RSVP message.
- RSVP is intentionally just a WhatsApp deep link (no backend/database).
