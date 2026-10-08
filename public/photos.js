(() => {
  const local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const sections = { hero: "heroImage", venue: "venue", moments: "moments" };

  const describe = (photo, metadata = {}) => {
    const value = typeof photo === "string" ? { src: photo } : photo || {};
    return { ...metadata[value.src], ...value };
  };

  const sources = (config, uploads, section) => {
    const uploaded = uploads[section];
    const overridden = uploads.overrides?.[section] || (Array.isArray(uploaded) ? uploaded.length > 0 : Boolean(uploaded));
    if (overridden) return (Array.isArray(uploaded) ? uploaded : [uploaded]).filter(Boolean);
    const fallback = section === "venue" ? config.venue?.image : config[sections[section]];
    return (Array.isArray(fallback) ? fallback : [fallback]).filter(Boolean);
  };

  const imageUrl = (source, width) => {
    const original = new URL(source, document.baseURI);
    if (local || original.origin !== location.origin || !/^https?:$/.test(original.protocol)) return original.href;
    return `/.netlify/images?url=${encodeURIComponent(original.pathname)}&w=${width}&fm=webp&q=80`;
  };

  const setImg = (image, source, width = 1200, options = {}) => {
    const photo = describe(source, options.metadata);
    const frame = options.frame || image.parentElement;
    if (!photo.src) {
      image.removeAttribute("src");
      image.removeAttribute("srcset");
      if (frame) frame.hidden = true;
      return;
    }
    if (frame) frame.hidden = false;
    const sizeFrame = (naturalWidth, naturalHeight) => {
      if (!(naturalWidth > 0 && naturalHeight > 0)) return;
      image.width = naturalWidth;
      image.height = naturalHeight;
      if (frame) {
        const ratio = naturalWidth / naturalHeight;
        frame.style.setProperty("--photo-ratio", String(ratio));
        let orientation = "square";
        if (ratio > 1.18) orientation = "landscape";
        else if (ratio < 0.85) orientation = "portrait";
        frame.dataset.orientation = orientation;
      }
      options.onSize?.(naturalWidth, naturalHeight);
    };
    sizeFrame(photo.width, photo.height);
    image.decoding = "async";
    image.loading = options.eager ? "eager" : "lazy";
    image.fetchPriority = options.eager ? "high" : "auto";
    if (photo.alt) image.alt = photo.alt;
    image.onload = () => {
      sizeFrame(image.naturalWidth, image.naturalHeight);
      frame?.classList.remove("image-unavailable");
    };
    const original = new URL(photo.src, document.baseURI).href;
    let triedOriginal = false;
    image.onerror = () => {
      if (!triedOriginal && image.src !== original) {
        triedOriginal = true;
        image.removeAttribute("srcset");
        image.src = original;
        return;
      }
      image.onerror = null;
      frame?.classList.add("image-unavailable");
      options.onError?.();
    };
    image.removeAttribute("srcset");
    if (!local && new URL(original).origin === location.origin) {
      const widths = [...new Set([480, 800, 1200, width].filter((size) => size <= width))].sort((first, second) => first - second);
      image.srcset = widths.map((size) => `${imageUrl(photo.src, size)} ${size}w`).join(", ");
      image.sizes = options.sizes || "(max-width: 700px) 100vw, 50vw";
    }
    image.src = imageUrl(photo.src, width);
    if (image.complete && image.naturalWidth) sizeFrame(image.naturalWidth, image.naturalHeight);
  };

  const load = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(new URL("api/images", document.baseURI), { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Photo service is unavailable. Please try again.");
      const manifest = await response.json();
      if (!manifest || Array.isArray(manifest) || typeof manifest !== "object") throw new Error("The photo service returned an invalid response.");
      return manifest;
    } finally {
      clearTimeout(timeout);
    }
  };

  window.WEDDING_PHOTOS = { describe, sources, imageUrl, setImg, load };
})();