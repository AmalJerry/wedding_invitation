/* =====================================================================
   WEDDING INVITATION — CONFIGURATION
   ---------------------------------------------------------------------
   Everything on the site comes from this one file. Edit the values
   below, drop photos into  public/images/  and redeploy. Done.

   Photos: use paths like "images/my-photo.jpg". JPG, PNG or WebP all
   work — they are resized and compressed automatically on Netlify.
   Leave any optional text as "" to hide it.
   ===================================================================== */

window.WEDDING_CONFIG = {
  // ---- The couple -----------------------------------------------------
  groom: {
    name: "Abhimanyu",
    family: "", // e.g. "Son of Mr. Rajan & Mrs. Latha"
  },
  bride: {
    name: "Arundathi Das",
    family: "", // e.g. "Daughter of Mr. Das & Mrs. Meera"
  },
  monogram: "A & A", // shown on the envelope seal

  // ---- Date & time ----------------------------------------------------
  // The main celebration guests are invited to (drives the scratch card,
  // countdown and Google Calendar button). ISO format with your timezone.
  start: "2026-11-02T16:30:00+05:30",
  end: "2026-11-02T21:30:00+05:30",
  timeZone: "Asia/Kolkata", // used to display the date & time

  // ---- Words ----------------------------------------------------------
  intro: "Together with our families",
  invitationLine: "request the honour of your presence as we celebrate our wedding reception",
  // Small line under the hero date, e.g. to mention the wedding ceremony
  weddingNote: "Following our wedding at Guruvayur Temple on 1st November",
  closingNote:
    "Your presence will make our celebration complete. We can't wait to share this joyful evening with you.",

  // ---- Photos ---------------------------------------------------------
  heroImage: "images/couple.png", // main portrait (4:5 portrait works best)
  // "A glimpse of us" swipeable carousel
  gallery: [
    { src: "images/gallery-5.png", caption: "Every road led to you" },
    { src: "images/gallery-1.png", caption: "Two hearts, one promise" },
    { src: "images/gallery-2.png", caption: "Hand in hand" },
    { src: "images/gallery-4.png", caption: "Golden moments" },
  ],
  // "Our moments" photo grid (any number of photos)
  moments: [
    "images/gallery-3.png",
    "images/gallery-6.png",
    "images/gallery-1.png",
    "images/gallery-4.png",
    "images/gallery-2.png",
    "images/gallery-5.png",
  ],

  // ---- Events (add as many as you like) -------------------------------
  // "date" is shown on each card; leave "time" as "" to hide it.
  eventsIntro: "Two days of togetherness",
  events: [
    {
      title: "The Wedding",
      date: "2026-11-01",
      time: "",
      description: "We tie the knot in the blessed presence of Guruvayurappan, surrounded by our families.",
      venue: "Guruvayur Temple",
    },
    {
      title: "Wedding Reception",
      date: "2026-11-02",
      time: "4:30 PM – 9:30 PM",
      description: "An evening of love, laughter, music and dinner with family and friends.",
      venue: "Kadheeja Castle",
    },
    // { title: "Dinner", time: "7:30 PM", description: "...", venue: "Kadheeja Castle" },
  ],

  // ---- Venue ----------------------------------------------------------
  venue: {
    name: "Kadheeja Castle",
    address: "", // e.g. "Main Road, Town, Kerala"
    image: "images/venue.png",
    // What Google Maps should search for (name + town is usually enough)
    mapQuery: "Kadheeja Castle",
    // Optional: paste an exact Google Maps share link to override the search
    directionsUrl: "",
  },

  // ---- RSVP on WhatsApp -----------------------------------------------
  rsvp: {
    // Country code + number, digits only (e.g. "919876543210").
    // Leave "" to let guests pick the contact themselves.
    whatsappNumber: "",
    message: "Hi! I'm delighted to confirm my presence at Abhimanyu & Arundathi's wedding reception on 2nd November. ❤️",
    buttonText: "Yes, I'll be there!",
    // Small helper text shown under the button
    note: "Tap to send us a quick WhatsApp message — kindly let us know by 25th October",
    deadline: "",
  },

  // ---- Background music (optional) ------------------------------------
  // Put an mp3 into public/music/ and set e.g. "music/our-song.mp3"
  // Default: Debussy's "Clair de Lune" (public-domain recording, Wikimedia Commons)
  music: "music/clair-de-lune.mp3",

  // ---- Look & feel ----------------------------------------------------
  theme: {
    accent: "#a8813a", // antique gold
    deep: "#6b1d2a", // maroon
    paper: "#fbf6ee", // ivory background
  },
};
