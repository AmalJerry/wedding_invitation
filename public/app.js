(() => {
  const C = window.WEDDING_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tz = C.timeZone || "Asia/Kolkata";

  // ---------- Images via Netlify Image CDN (falls back to the original) ----------
  const cdn = (src, w) =>
    /^https?:/.test(src) ? src : `/.netlify/images?url=${encodeURIComponent("/" + src.replace(/^\//, ""))}&w=${w}&fm=webp&q=78`;
  const setImg = (img, src, w) => {
    img.src = cdn(src, w);
    img.onerror = () => { img.onerror = null; img.src = "/" + src.replace(/^\//, ""); };
    // photos are shown whole (object-fit: contain); the frame behind gets a blurred copy to fill the spare space
    img.onload = () => img.parentElement && img.parentElement.style.setProperty("--bg", `url("${img.currentSrc || img.src}")`);
  };

  // ---------- Theme & text ----------
  const root = document.documentElement.style;
  if (C.theme) {
    if (C.theme.accent) root.setProperty("--gold", C.theme.accent);
    if (C.theme.deep) root.setProperty("--deep", C.theme.deep);
    if (C.theme.paper) root.setProperty("--paper", C.theme.paper);
  }

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

  setImg($("[data-hero]"), C.heroImage, 840);
  setImg($("[data-venue-img]"), C.venue.image, 1100);

  // ---------- Envelope + music ----------
  const env = $("#envelope");
  const audio = $("#music");
  const musicBtn = $("#musicBtn");
  if (C.music) {
    audio.src = C.music;
    musicBtn.hidden = false;
    musicBtn.onclick = () => (audio.paused ? playMusic() : audio.pause());
    audio.onplay = () => musicBtn.classList.add("playing");
    audio.onpause = () => musicBtn.classList.remove("playing");
  }
  // Soft fade-in so the piano never startles anyone
  function playMusic() {
    audio.volume = 0;
    audio.play().then(() => {
      const fade = setInterval(() => {
        audio.volume = Math.min(0.55, audio.volume + 0.03);
        if (audio.volume >= 0.55) clearInterval(fade);
      }, 120);
    }).catch(() => {});
  }
  const open = () => {
    if (env.classList.contains("open")) return;
    env.classList.add("open");
    document.body.classList.remove("locked");
    if (C.music) playMusic();
    startPetals();
    setTimeout(watch, 500);
    setTimeout(() => env.classList.add("gone"), 1400);
  };
  env.addEventListener("click", open);
  env.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && open());

  // ---------- Reveal on scroll ----------
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
    { threshold: 0.15 }
  );
  const watch = () => $$(".reveal:not(.in)").forEach((el) => io.observe(el));

  // ---------- Scratch card ----------
  const card = $(".scratch");
  const cv = $("#scratch");
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const paintScratch = () => {
    const r = cv.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, r.width, r.height);
    g.addColorStop(0, "#c9a45c"); g.addColorStop(0.45, "#f1dca4"); g.addColorStop(0.55, "#d9b66e"); g.addColorStop(1, "#9c7633");
    ctx.fillStyle = g; ctx.fillRect(0, 0, r.width, r.height);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`;
      ctx.beginPath(); ctx.arc(Math.random() * r.width, Math.random() * r.height, Math.random() * 1.6, 0, 7); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.font = `400 ${Math.round(r.width / 7)}px "Great Vibes", cursive`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Our Big Day", r.width / 2, r.height / 2 - 6);
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
    burst(card);
  };
  cv.addEventListener("pointerdown", (e) => { scratching = true; last = null; cv.setPointerCapture(e.pointerId); scratchAt(e); });
  cv.addEventListener("pointermove", (e) => scratching && scratchAt(e));
  cv.addEventListener("pointerup", () => { scratching = false; checkCleared(); });
  document.fonts.ready.then(paintScratch);

  // ---------- Calendar ----------
  const utc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
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
  let lbList = [], lbIdx = 0;
  const showLb = () => setImg(lbImg, lbList[lbIdx], 1600);
  const openLb = (list, i) => { lbList = list; lbIdx = i; showLb(); lb.hidden = false; };
  const stepLb = (d) => { lbIdx = (lbIdx + d + lbList.length) % lbList.length; showLb(); };
  $(".lb-close").onclick = () => (lb.hidden = true);
  $(".lb-prev").onclick = () => stepLb(-1);
  $(".lb-next").onclick = () => stepLb(1);
  lb.addEventListener("click", (e) => e.target === lb && (lb.hidden = true));
  addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") lb.hidden = true;
    if (e.key === "ArrowLeft") stepLb(-1);
    if (e.key === "ArrowRight") stepLb(1);
  });

  // ---------- Carousel ----------
  const gallery = (C.gallery || []).map((g) => (typeof g === "string" ? { src: g } : g));
  const track = $("#track"), dots = $("#dots");
  let idx = 0, timer;
  gallery.forEach((g, i) => {
    const fig = document.createElement("figure");
    fig.className = "slide";
    const img = new Image();
    img.alt = g.caption || `Photo ${i + 1}`;
    img.loading = i ? "lazy" : "eager";
    setImg(img, g.src, 1400);
    img.draggable = false;
    img.onclick = () => !swiped && openLb(gallery.map((x) => x.src), i);
    fig.append(img);
    if (g.caption) { const c = document.createElement("figcaption"); c.textContent = g.caption; fig.append(c); }
    track.append(fig);
    const dot = document.createElement("button");
    dot.setAttribute("aria-label", `Photo ${i + 1}`);
    dot.onclick = () => go(i);
    dots.append(dot);
  });
  const go = (i) => {
    idx = (i + gallery.length) % gallery.length;
    track.style.transform = `translateX(-${idx * 100}%)`;
    $$("button", dots).forEach((d, j) => d.classList.toggle("on", j === idx));
    clearTimeout(timer);
    if (!reduced) timer = setTimeout(() => go(idx + 1), 5000);
  };
  $(".prev").onclick = () => go(idx - 1);
  $(".next").onclick = () => go(idx + 1);
  let sx = null, swiped = false;
  track.addEventListener("pointerdown", (e) => (sx = e.clientX));
  track.addEventListener("pointerup", (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 40) { swiped = true; setTimeout(() => (swiped = false), 60); go(idx + (dx < 0 ? 1 : -1)); }
  });
  if (gallery.length) go(0); else $("#gallery").hidden = true;
  if (gallery.length < 2) $$(".carousel .nav").forEach((b) => (b.hidden = true));

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

  // ---------- Venue ----------
  const q = encodeURIComponent(C.venue.mapQuery || where);
  $("#map").src = `https://maps.google.com/maps?q=${q}&z=15&output=embed`;
  $("#directions").href = C.venue.directionsUrl || `https://www.google.com/maps/dir/?api=1&destination=${q}`;

  // ---------- Moments grid ----------
  const moments = C.moments || [];
  const grid = $("#grid");
  moments.forEach((src, i) => {
    const b = document.createElement("button");
    b.className = "reveal";
    b.setAttribute("aria-label", `Open photo ${i + 1}`);
    const img = new Image();
    img.alt = ""; img.loading = "lazy";
    setImg(img, src, 800);
    b.append(img);
    b.onclick = () => openLb(moments, i);
    grid.append(b);
  });
  if (!moments.length) $("#moments").hidden = true;

  // ---------- RSVP ----------
  const num = (C.rsvp?.whatsappNumber || "").replace(/\D/g, "");
  const msg = encodeURIComponent((guest ? `${C.rsvp.message} — ${guest}` : C.rsvp?.message) || "");
  $("#wa").href = `https://wa.me/${num}?text=${msg}`;

  // ---------- Dock: hide links for hidden sections, highlight current ----------
  const links = $$(".dock a");
  links.forEach((a) => { const s = $(a.getAttribute("href")); if (!s || s.hidden) a.hidden = true; });
  const spy = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
    }),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  $$("main > section").forEach((s) => spy.observe(s));

  // ---------- Petals ----------
  const pc = $("#petals"), px = pc.getContext("2d");
  let petals = [], running = false;
  const size = () => { pc.width = innerWidth * devicePixelRatio; pc.height = innerHeight * devicePixelRatio; };
  addEventListener("resize", size);
  const colors = ["#f3c9c9", "#efd9a6", "#ffffff", "#e7a9a1"];
  const mk = (top) => ({
    x: Math.random() * innerWidth, y: top ? -20 : Math.random() * innerHeight,
    r: 5 + Math.random() * 6, vy: 0.4 + Math.random() * 0.8, vx: Math.random() - 0.5,
    a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.04, c: colors[(Math.random() * colors.length) | 0],
    sway: Math.random() * 6.28,
  });
  function startPetals() {
    if (reduced || running) return;
    running = true; size();
    petals = Array.from({ length: innerWidth < 600 ? 16 : 26 }, () => mk(false));
    (function frame() {
      px.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      px.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of petals) {
        p.sway += 0.02; if (p.vy < 0.5) p.vy += 0.06; p.vx *= 0.99; p.y += p.vy; p.x += p.vx + Math.sin(p.sway) * 0.4; p.a += p.va;
        if (p.y > innerHeight + 20) Object.assign(p, mk(true));
        px.save(); px.translate(p.x, p.y); px.rotate(p.a);
        px.globalAlpha = 0.55; px.fillStyle = p.c;
        px.beginPath(); px.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 6.28); px.fill();
        px.restore();
      }
      requestAnimationFrame(frame);
    })();
  }

  // Little celebration burst when the date is revealed
  function burst(el) {
    if (reduced) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 24; i++) {
      const p = mk(false);
      p.x = r.left + r.width / 2; p.y = r.top + r.height / 2;
      p.vx = (Math.random() - 0.5) * 6; p.vy = -Math.random() * 4 - 1;
      petals.push(p);
    }
    setTimeout(() => (petals = petals.slice(0, innerWidth < 600 ? 16 : 26)), 6000);
  }
})();
