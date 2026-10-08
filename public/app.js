(() => {
  const C = window.WEDDING_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tz = C.timeZone || "Asia/Kolkata";
  const photos = window.WEDDING_PHOTOS;
  const uploadsReady = photos.load().catch(() => ({}));
  let photoMetadata = C.imageMeta || {};
  const setImg = (image, source, width, options = {}) => photos.setImg(image, source, width, { metadata: photoMetadata, ...options });

  // ---------- Theme & text ----------
  const root = document.documentElement.style;
  if (C.theme) {
    if (C.theme.accent) root.setProperty("--gold", C.theme.accent);
    if (C.theme.deep) root.setProperty("--deep", C.theme.deep);
    if (C.theme.paper) root.setProperty("--paper", C.theme.paper);
    if (C.theme.rose) root.setProperty("--rose", C.theme.rose);
  }
  $("meta[name='theme-color']").content = C.theme?.deep || "#284d40";

  const start = new Date(C.start);
  const end = new Date(C.end || C.start);
  const fmt = (opts, d = start) => new Intl.DateTimeFormat("en-IN", { timeZone: tz, ...opts }).format(d);
  const time = (d) => fmt({ hour: "numeric", minute: "2-digit", hour12: true }, d).toUpperCase();
  const pad = (n) => String(n).padStart(2, "0");
  const dd = fmt({ day: "2-digit" }), mm = fmt({ month: "2-digit" }), yyyy = fmt({ year: "numeric" });

  const text = {
    "data-groom": C.groom.name,
    "data-bride": C.bride.name,
    "data-groom-family": C.groom.family,
    "data-bride-family": C.bride.family,
    "data-monogram": C.monogram,
    "data-intro": C.intro,
    "data-invitation": C.invitationLine,
    "data-closing": C.closingNote,
    "data-deadline": C.rsvp?.deadline,
    "data-wedding-note": C.weddingNote,
    "data-events-intro": C.eventsIntro,
    "data-rsvp-button": C.rsvp?.buttonText || "Yes, I'll be there!",
    "data-rsvp-note": C.rsvp?.note,
    "data-weekday": fmt({ weekday: "long" }),
    "data-day": fmt({ day: "numeric" }),
    "data-month-year": fmt({ month: "long", year: "numeric" }),
    "data-time-range": `${time(start)} – ${time(end)}`,
    "data-short-date": fmt({ weekday: "short", day: "numeric", month: "long", year: "numeric" }),
    "data-dot-date": `${dd} • ${mm} • ${yyyy}`,
    "data-venue-name": C.venue.name,
    "data-venue-address": C.venue.address,
  };
  for (const [attr, val] of Object.entries(text)) $$(`[${attr}]`).forEach((el) => (el.textContent = val || ""));
  document.title = `${C.groom.name} & ${C.bride.name} — Wedding Invitation`;

  const guest = new URLSearchParams(location.search).get("to");
  if (guest) { const g = $("[data-guest]"); g.textContent = `Dear ${guest},`; g.hidden = false; }

  // ---------- Envelope + music ----------
  const env = $("#envelope");
  const audio = $("#music");
  const musicBtn = $("#musicBtn");
  const main = $("main");
  const dock = $(".dock");
  main.inert = true;
  dock.inert = true;
  let musicFade;
  if (C.music) {
    audio.src = C.music;
    musicBtn.hidden = false;
    musicBtn.onclick = () => (audio.paused ? playMusic() : audio.pause());
    audio.onplay = () => { musicBtn.classList.add("playing"); musicBtn.setAttribute("aria-label", "Pause music"); };
    audio.onpause = () => { clearInterval(musicFade); musicBtn.classList.remove("playing"); musicBtn.setAttribute("aria-label", "Play music"); };
    audio.onerror = () => { clearInterval(musicFade); musicBtn.hidden = true; };
  }
  // Soft fade-in so the piano never startles anyone
  function playMusic() {
    clearInterval(musicFade);
    audio.volume = 0;
    audio.play().then(() => {
      musicFade = setInterval(() => {
        audio.volume = Math.min(0.55, audio.volume + 0.03);
        if (audio.volume >= 0.55) clearInterval(musicFade);
      }, 120);
    }).catch(() => {});
  }
  const open = () => {
    if (env.classList.contains("open")) return;
    env.classList.add("open");
    document.body.classList.remove("locked");
    main.inert = false;
    dock.inert = false;
    if (C.music) playMusic();
    watch();
    setTimeout(() => { env.classList.add("gone"); main.focus({ preventScroll: true }); }, reduced ? 0 : 700);
  };
  $(".envelope-open").addEventListener("click", open);

  // ---------- Reveal on scroll ----------
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
    { threshold: 0.15 }
  );
  const watch = () => $$(".reveal:not(.in)").forEach((el) => io.observe(el));

  // ---------- Scratch card ----------
  const card = $(".scratch");
  const cv = $("#scratch");
  const revealButton = $("#revealDate");
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const paintScratch = () => {
    if (card.classList.contains("done") || !ctx) return;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, r.width, r.height);
    g.addColorStop(0, "#c9a45c"); g.addColorStop(0.45, "#f1dca4"); g.addColorStop(0.55, "#d9b66e"); g.addColorStop(1, "#9c7633");
    ctx.fillStyle = g; ctx.fillRect(0, 0, r.width, r.height);
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.font = `400 ${Math.round(r.width / 7)}px "Great Vibes", cursive`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const hint = C.scratchHint || "";
    ctx.fillText("Our Big Day", r.width / 2, r.height / 2 - (hint ? 16 : 6));
    if (hint) {
      ctx.font = `500 ${Math.max(11, Math.round(r.width / 26))}px "Jost", system-ui, sans-serif`;
      ctx.letterSpacing = "0.18em";
      ctx.fillText(`✦ ${hint.toUpperCase()} ✦`, r.width / 2, r.height / 2 + r.width / 9);
      ctx.letterSpacing = "0px";
    }
    ctx.globalCompositeOperation = "destination-out";
  };
  let scratching = false, last = null, moves = 0;
  const scratchAt = (e) => {
    const r = cv.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    ctx.lineWidth = 44; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo((last || p).x, (last || p).y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
    if (++moves % 12 === 0) checkCleared();
  };
  const checkCleared = () => {
    const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
    let clear = 0, total = 0;
    for (let i = 3; i < data.length; i += 64) { total++; if (data[i] === 0) clear++; }
    if (clear / total > 0.45) revealDate();
  };
  const revealDate = () => {
    if (card.classList.contains("done")) return;
    card.classList.add("done");
    revealButton.setAttribute("aria-pressed", "true");
    revealButton.disabled = true;
    $("#gcal").focus({ preventScroll: true });
  };
  cv.addEventListener("pointerdown", (e) => { scratching = true; last = null; cv.setPointerCapture(e.pointerId); scratchAt(e); });
  cv.addEventListener("pointermove", (e) => scratching && scratchAt(e));
  cv.addEventListener("pointerup", () => { scratching = false; checkCleared(); });
  cv.addEventListener("pointercancel", () => { scratching = false; last = null; });
  revealButton.addEventListener("click", (event) => { if (event.detail === 0) revealDate(); });
  new ResizeObserver(paintScratch).observe(card);
  document.fonts.ready.then(paintScratch).catch(() => {});

  // ---------- Calendar ----------
  const utc = (date) => date.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z";
  const mainEvent = (C.events || []).find((e) => e.date === `${yyyy}-${mm}-${dd}`);
  const evTitle = `${C.groom.name} & ${C.bride.name} — ${mainEvent?.title || "Wedding"}`;
  const where = [C.venue.name, C.venue.address].filter(Boolean).join(", ");
  $("#gcal").href =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(evTitle)}&dates=${utc(start)}/${utc(end)}` +
    `&location=${encodeURIComponent(where)}&details=${encodeURIComponent(location.href.split("?")[0])}`;

  // ---------- Countdown ----------
  const cd = Object.fromEntries($$("[data-cd]").map((el) => [el.dataset.cd, el]));
  const tick = () => {
    const diff = start - Date.now();
    if (diff <= 0) { $("#count").hidden = true; $("#countDone").hidden = false; return; }
    const s = Math.floor(diff / 1000);
    cd.d.textContent = Math.floor(s / 86400);
    cd.h.textContent = pad(Math.floor((s % 86400) / 3600));
    cd.m.textContent = pad(Math.floor((s % 3600) / 60));
    cd.s.textContent = pad(s % 60);
    setTimeout(tick, 1000);
  };
  tick();

  // ---------- Lightbox ----------
  const lb = $("#lightbox"), lbImg = $("#lbImg");
  let lbList = [], lbIdx = 0, lastFocus;
  const showLb = () => {
    lbImg.alt = photos.describe(lbList[lbIdx], photoMetadata).alt || `Wedding photo ${lbIdx + 1} of ${lbList.length}`;
    setImg(lbImg, lbList[lbIdx], 1800, { eager: true, frame: lbImg, sizes: "100vw" });
  };
  const closeLb = () => {
    lb.close();
    lb.hidden = true;
    document.body.classList.remove("viewing-photo");
    main.inert = false;
    dock.inert = false;
    musicBtn.inert = false;
    lastFocus?.focus({ preventScroll: true });
  };
  const openLb = (list, index) => {
    lbList = list;
    lbIdx = index;
    lastFocus = document.activeElement;
    lb.hidden = false;
    lb.showModal();
    document.body.classList.add("viewing-photo");
    main.inert = true;
    dock.inert = true;
    musicBtn.inert = true;
    $$(".lb-nav").forEach((button) => { button.hidden = list.length < 2; });
    showLb();
    $(".lb-close").focus();
  };
  const stepLb = (d) => { lbIdx = (lbIdx + d + lbList.length) % lbList.length; showLb(); };
  $(".lb-close").onclick = closeLb;
  $(".lb-prev").onclick = () => stepLb(-1);
  $(".lb-next").onclick = () => stepLb(1);
  lb.addEventListener("click", (event) => { if (event.target === lb) closeLb(); });
  lb.addEventListener("cancel", (event) => { event.preventDefault(); closeLb(); });
  addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") stepLb(-1);
    if (e.key === "ArrowRight") stepLb(1);
    if (e.key === "Tab") {
      const buttons = $$("button:not([hidden])", lb);
      const next = (buttons.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      e.preventDefault();
      buttons[next].focus();
    }
  });

  // ---------- Events ----------
  const tl = $("#timeline");
  (C.events || []).forEach((ev) => {
    const el = document.createElement("article");
    el.className = "event reveal";
    el.innerHTML = `<p class="ev-date"></p><h4></h4><p class="ev-time"></p><p class="ev-desc"></p><p class="ev-venue"></p>`;
    $(".ev-date", el).textContent = ev.date
      ? fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }, new Date(`${ev.date}T12:00:00Z`))
      : "";
    $("h4", el).textContent = ev.title;
    $(".ev-time", el).textContent = ev.time || "";
    $(".ev-desc", el).textContent = ev.description || "";
    $(".ev-venue", el).textContent = ev.venue ? `at ${ev.venue}` : "";
    tl.append(el);
  });
  $("#events").hidden = !(C.events || []).length;

  // ---------- Venue ----------
  const q = encodeURIComponent(C.venue.mapQuery || where);
  const mapObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    if (where || C.venue.mapQuery) $("#map").src = `https://maps.google.com/maps?q=${q}&z=15&output=embed`;
    else $(".map").hidden = true;
    mapObserver.disconnect();
  }, { rootMargin: "300px" });
  mapObserver.observe($("#venue"));
  $("#directions").href = C.venue.directionsUrl || `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  $("#directions").hidden = !(where || C.venue.mapQuery || C.venue.directionsUrl);

  // ---------- Moments grid ----------
  const grid = $("#grid");
  const renderPhotos = (uploads) => {
    photoMetadata = { ...C.imageMeta, ...uploads.metadata };
    const hero = photos.sources(C, uploads, "hero")[0];
    const venue = photos.sources(C, uploads, "venue")[0];
    setImg($("[data-hero]"), hero, 1200, { eager: true, sizes: "(max-width: 850px) 90vw, 45vw" });
    setImg($("[data-venue-img]"), venue, 1400);
    $("#home").classList.toggle("no-photo", !hero);
    $("#venue").hidden = !venue && !where && !C.venue.mapQuery;
    const moments = photos.sources(C, uploads, "moments");
    grid.replaceChildren();
    moments.forEach((source, index) => {
      const button = document.createElement("button");
      button.className = "moment reveal";
      button.setAttribute("aria-label", `Open photo ${index + 1}`);
      const image = new Image();
      image.alt = `Wedding moment ${index + 1}`;
      button.append(image);
      setImg(image, source, 1000, { sizes: "(max-width: 550px) 90vw, (max-width: 850px) 45vw, 30vw" });
      button.onclick = () => openLb(moments, index);
      grid.append(button);
    });
    $("#moments").hidden = !moments.length;
    syncSections();
    if (env.classList.contains("open")) watch();
  };

  // ---------- RSVP ----------
  const num = (C.rsvp?.whatsappNumber || "").replace(/\D/g, "");
  const msg = encodeURIComponent([C.rsvp?.message, guest].filter(Boolean).join(" — "));
  $("#wa").href = `https://wa.me/${num}?text=${msg}`;
  $("#wa").hidden = !C.rsvp?.message;

  // ---------- Number only the visible sections (01, 02, …) so hidden ones leave no gap ----------
  // ---------- Dock: hide links for hidden sections, highlight current ----------
  const links = $$(".dock a");
  const syncSections = () => {
    $$(".sec-num").filter((number) => !number.closest("section").hidden).forEach((number, index) => (number.textContent = String(index + 1).padStart(2, "0")));
    links.forEach((link) => { const section = $(link.getAttribute("href")); link.hidden = !section || section.hidden; });
  };
  const spy = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
    }),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  $$("main > section").forEach((s) => spy.observe(s));
  uploadsReady.then(renderPhotos);
  syncSections();
  if (new URLSearchParams(location.search).has("preview")) open();
})();
