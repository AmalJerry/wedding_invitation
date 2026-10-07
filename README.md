# Abhimanyu & Arundathi — Wedding Invitation

A single-page, mobile-first digital wedding invitation. Guests open a wax-sealed envelope, scratch a gold card to reveal the date, watch a live countdown, browse photos, find the venue on a map, add the event to their calendar and RSVP on WhatsApp.

Everything — names, date, venue, events, photos, colours, music, RSVP number — comes from **one file: `public/config.js`**.

## Customise it

1. Put photos in `public/images/` (JPG, PNG or WebP; any size — Netlify Image CDN resizes and compresses them).
2. Edit `public/config.js`: names, family lines, date/time, events, venue, the `heroImage`, `gallery` and `moments` photo lists, WhatsApp number and theme colours.
3. Optional: drop an mp3 in `public/music/` and set `music: "music/song.mp3"` to get background music with a toggle button.
4. Commit and deploy.

**Personalised links:** add `?to=Name` to the URL (e.g. `https://your-site.netlify.app/?to=Rahul%20%26%20Family`) and the envelope greets that guest by name, and their name is added to the WhatsApp RSVP message.

## Tech

- Plain HTML, CSS and vanilla JavaScript — no framework, no build step
- Netlify static hosting (`publish = "public"`) and Netlify Image CDN for optimised photos
- Google Fonts (Cormorant Garamond, Great Vibes, Jost), Google Maps embed, WhatsApp `wa.me` links

## Run locally

```bash
netlify dev --port 8889
```

Then open http://localhost:8889. (Opening `public/index.html` straight from disk also works; images fall back to the originals.)
