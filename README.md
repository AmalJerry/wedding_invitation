# Abhimanyu & Arundathi — Wedding Invitation

A single-page, mobile-first digital wedding invitation. Guests open a wax-sealed envelope, scratch a gold card to reveal the date, watch a live countdown, browse photos, find the venue on a map, add the event to their calendar and RSVP on WhatsApp.

Everything — names, date, venue, events, photos, colours, music, RSVP number — comes from **one file: `public/config.js`**.

## Customise it

1. Put photos in `public/images/` (JPG, PNG or WebP; any size — Netlify Image CDN resizes and compresses them).
2. Edit `public/config.js`: names, family lines, date/time, events, venue, `heroImage`, `moments`, WhatsApp number and theme colours. The separate gallery carousel has been removed.
3. Optional: drop an mp3 in `public/music/` and set `music: "music/song.mp3"` to get background music with a toggle button.
4. Commit and deploy.

**Personalised links:** add `?to=Name` to the URL (e.g. `https://your-site.netlify.app/?to=Rahul%20%26%20Family`) and the envelope greets that guest by name, and their name is added to the WhatsApp RSVP message.

## Photo Admin

Open `/admin.html` on your Netlify site. The library shows the photos currently used by the invitation, including defaults from `public/config.js`.

- **Cover photo:** one opening photo. A new upload replaces it.
- **Venue photo:** one photo beside the venue details.
- **Our moments:** a collection of up to 60 photos. Add photos or use a numbered photo's Replace button to change that exact position. Arrow buttons change their order.
- **Remove:** removes a single photo. Removing the last photo hides the related photo area.
- **Hide photos:** hides all photos in the selected section.
- **Restore defaults:** removes that section's uploaded overrides and restores the photos configured in `public/config.js`.

Editing requires `ADMIN_PASSWORD`, configured in Netlify's environment variables with the **Functions** scope. Keep the existing password if it is already configured; otherwise add it and redeploy. Functions only see variables that existed when the deploy was built, so any time `ADMIN_PASSWORD` is added or changed, trigger a new deploy (Deploys → Trigger deploy → Deploy project). If the admin shows "ADMIN_PASSWORD is not set for Functions", the live deploy predates the variable and needs a redeploy. The password is not stored in browser storage. Use Lock editing when finished.

Select JPG, PNG or WebP files up to 20 MB each. Photos are previewed before upload, resized to at most 1920 pixels on their longest edge, and compressed in the browser. HEIC and other formats must be converted first. Uploads are saved immediately; there is no separate Publish button. The preview link opens the selected section of the invitation.

Photo frames follow the image's natural aspect ratio without cropping or blurred filler. Uploaded dimensions are stored automatically. Optional `imageMeta` entries in the configuration reserve space for default photos; update those dimensions when replacing a default file. An image's actual loaded dimensions always take precedence.

Uploads remain in the existing Netlify Blobs `photos` store. Existing uploaded image URLs are preserved, and concurrent saves are checked to avoid overwriting another editor's changes. Do not remove the legacy store when deploying this update.

## Tech

- Plain HTML, CSS and vanilla JavaScript — no framework, no build step
- Netlify static hosting (`publish = "public"`) and Netlify Image CDN for optimised photos
- Existing `/api/images` and `/img/*` Netlify Functions routes; `netlify.toml` is unchanged
- Google Fonts (Cormorant Garamond, Great Vibes, Jost), Google Maps embed, WhatsApp `wa.me` links
- Lazy-loaded below-the-fold images and map; responsive Image CDN sources; reduced-motion support
- Development-only Node and Playwright tests; no frontend framework or production build step

## Run locally

Use Node.js 22 or newer. Netlify builds use Node 22 LTS, selected by `.nvmrc`.

```bash
npm ci
npm run dev
```

Open http://localhost:8889 for the invitation and http://localhost:8889/admin.html for the admin. The development command uses Netlify's offline sandbox, so it does not modify the deployed site's photos. If port 8889 is occupied, use `npx netlify-cli dev --offline --port 8890`.

For local uploads, set `ADMIN_PASSWORD` in an ignored `.env` file and restart the development server. Do not commit passwords. Without that variable, the invitation and photo browsing still work, but saving photos is disabled by the API.

Opening `public/index.html` directly also displays the invitation using the original image files. Admin uploads require the Netlify Functions server. The invitation remains interactive if the image API is slow or unavailable, and falls back to configured photos.

## Verify

```bash
npm test
npx playwright install chromium
npm run test:ui
```

Run the browser tests while the local server is running on port 8889. They use the real image handler with an isolated temporary store, never your deployed photo library. Tests cover authentication, upload validation, exact photo slots, ordering, hiding and restoring, conflicts, failure recovery, keyboard interactions, image ratios and desktop/mobile overflow. Screenshots are saved under the ignored `test-results/` directory.

## Deploy

Deploy the repository through your existing Netlify connection as usual. Keep `publish = "public"`, the empty build command, the current Functions setup and existing `ADMIN_PASSWORD`. No migration, frontend build or hosting changes are required.
