(() => {
  const config = window.WEDDING_CONFIG;
  const photos = window.WEDDING_PHOTOS;
  const find = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const sections = {
    hero: { title: "Cover photo", location: "Opening photo", anchor: "home" },
    venue: { title: "Venue photo", location: "The Venue", anchor: "venue" },
    moments: { title: "Our moments", location: "Our Moments", anchor: "moments" },
  };
  let section = "hero";
  let uploads = {};
  let ready = false;
  let unlocked = false;
  let busy = false;
  let queue = [];
  let replacement = null;
  let pickerTarget = null;
  const password = find("#password");
  const fileInput = find("#fileInput");
  const dialog = find("#confirmDialog");
  const currentSources = () => photos.sources(config, uploads, section).map((source) => photos.describe(source).src);
  const metadata = () => ({ ...config.imageMeta, ...uploads.metadata });
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;

  find("#monogram").textContent = config.monogram || "W";
  find("#coupleNames").textContent = [config.groom?.name, config.bride?.name].filter(Boolean).join(" & ");

  const notify = (message, tone = "success") => {
    find("#message").textContent = message;
    find("#notice").dataset.tone = tone;
  };

  const availability = () => {
    all("[data-edit]").forEach((button) => { button.disabled = busy || !ready || !unlocked || button.dataset.unavailable === "true" || Boolean(queue.length && button.closest(".photo-card")); });
    all("[data-section]").forEach((button) => { button.disabled = busy; });
    all("#authForm button, #lockBtn, #retryBtn, #clearQueueBtn, [data-remove-queued]").forEach((button) => { button.disabled = busy; });
    password.disabled = busy;
    fileInput.disabled = busy || !unlocked || !ready;
    find("#authForm").hidden = unlocked;
    find("#unlockedPanel").hidden = !unlocked;
    find("#photoList").setAttribute("aria-busy", String(busy));
    find("#uploadBtn").disabled = busy || !ready || !unlocked || !queue.length;
  };

  const confirmChange = (title, message, action) => new Promise((resolve) => {
    find("#confirmTitle").textContent = title;
    find("#confirmMessage").textContent = message;
    find("#confirmAction").textContent = action;
    dialog.returnValue = "cancel";
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
    dialog.showModal();
  });

  const clearQueue = () => {
    queue.forEach((entry) => URL.revokeObjectURL(entry.url));
    queue = [];
    replacement = null;
    fileInput.value = "";
    renderQueue();
  };

  const send = async (selectedSection, values) => {
    const form = new FormData();
    const base = photos.sources(config, uploads, selectedSection).map((source) => photos.describe(source).src);
    for (const [key, value] of Object.entries({ password: password.value, section: selectedSection, revision: uploads.revision || "", base: JSON.stringify(base), ...values })) form.set(key, value);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(new URL("api/images", document.baseURI), { method: "POST", body: form, signal: controller.signal });
      if (!response.ok) {
        const text = await response.text();
        const error = new Error(text.startsWith("<") ? "The photo service is unavailable. Reload photos and try again." : text);
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally { clearTimeout(timeout); }
  };

  const perform = async (operation) => {
    if (busy) return;
    busy = true;
    availability();
    try { await operation(); }
    catch (error) {
      if (error.status === 401) unlocked = false;
      if (error.status === 409) {
        clearQueue();
        try { uploads = await photos.load(); ready = true; renderPhotos(); }
        catch { ready = false; }
      } else if (!error.status || error.status >= 500) ready = false;
      find("#retryBtn").hidden = ready;
      notify(error.name === "AbortError" ? "The request took too long. Reload photos before retrying." : error.message, "error");
    } finally {
      busy = false;
      find("#progress").hidden = true;
      availability();
    }
  };

  const loadPhotos = () => perform(async () => {
    notify("Loading saved photos...", "info");
    uploads = await photos.load();
    ready = true;
    find("#retryBtn").hidden = true;
    renderPhotos();
    notify(unlocked ? "Photos are up to date." : "Viewing photos. Editing is locked.", "info");
  });

  const chooseFiles = (target = null) => {
    if (busy || !ready || !unlocked) return;
    pickerTarget = target;
    fileInput.multiple = section === "moments" && !target;
    fileInput.value = "";
    fileInput.click();
  };

  const actionButton = (name, label, handler, unavailable = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-button${name === "trash" ? " destructive" : ""}`;
    button.innerHTML = icon(name);
    button.title = label;
    button.setAttribute("aria-label", label);
    button.dataset.edit = "";
    button.dataset.unavailable = String(unavailable);
    button.addEventListener("click", handler);
    return button;
  };

  const saveAction = (values, message) => perform(async () => {
    const selectedSection = section;
    uploads = await send(selectedSection, values);
    renderPhotos();
    notify(message);
  });

  const renderPhotos = () => {
    const details = sections[section];
    const sources = currentSources();
    find("#sectionTitle").textContent = details.title;
    find("#sectionMeta").textContent = `${details.location} / ${section === "moments" ? "Photo collection" : "Single photo"}`;
    find("#previewLink").href = `index.html?preview=1#${details.anchor}`;
    find("#uploadTitle").textContent = section === "moments" ? "New moments" : `New ${details.title.toLowerCase()}`;
    find("#chooseLabel").textContent = section === "moments" ? "Add photos" : "Choose photo";
    find("#photoCount").textContent = `${sources.length} ${sources.length === 1 ? "photo" : "photos"}`;
    find("#emptyState").hidden = sources.length > 0;
    find("#hideBtn").dataset.unavailable = String(!sources.length);
    all("[data-section]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.section === section)));
    all("[data-count]").forEach((counter) => { counter.textContent = photos.sources(config, uploads, counter.dataset.count).length; });
    const list = find("#photoList");
    list.classList.toggle("single", section !== "moments");
    list.replaceChildren();
    sources.forEach((source, index) => {
      const data = photos.describe(source, metadata());
      const label = section === "moments" ? `Moment ${String(index + 1).padStart(2, "0")}` : details.title;
      const card = document.createElement("article");
      card.className = "photo-card";
      card.innerHTML = `<header class="photo-card-header"><strong></strong><span class="photo-badge"></span></header><div class="photo-preview"><img alt=""></div><div class="photo-card-body"><p class="photo-name"></p><p class="photo-dimensions"></p><div class="photo-actions"></div></div>`;
      card.querySelector("strong").textContent = label;
      card.querySelector(".photo-badge").textContent = source.startsWith("img/") ? "Uploaded" : "Default";
      card.querySelector(".photo-name").textContent = data.name || source.split("/").pop();
      const image = card.querySelector("img");
      image.alt = label;
      photos.setImg(image, source, 800, {
        metadata: metadata(),
        eager: index < 3,
        sizes: "(max-width: 760px) 90vw, 40vw",
        onSize: (width, height) => {
          const orientation = card.querySelector(".photo-preview").dataset.orientation;
          card.querySelector(".photo-dimensions").textContent = `${width} x ${height} / ${orientation}`;
        },
      });
      const actions = card.querySelector(".photo-actions");
      const replace = actionButton("upload", `Replace ${label.toLowerCase()}`, () => chooseFiles(section === "moments" ? { target: source, index } : null));
      replace.className = "button secondary replace";
      replace.append(document.createTextNode("Replace"));
      actions.append(replace);
      if (section === "moments") {
        const move = (direction) => {
          const order = [...sources];
          [order[index], order[index + direction]] = [order[index + direction], order[index]];
          void saveAction({ action: "reorder", order: JSON.stringify(order) }, "Photo order saved.");
        };
        actions.append(actionButton("up", `Move ${label.toLowerCase()} earlier`, () => move(-1), index === 0));
        actions.append(actionButton("down", `Move ${label.toLowerCase()} later`, () => move(1), index === sources.length - 1));
      }
      actions.append(actionButton("trash", `Remove ${label.toLowerCase()}`, async () => {
        if (!await confirmChange(`Remove ${label.toLowerCase()}?`, "This photo will no longer appear on the invitation.", "Remove photo")) return;
        await saveAction({ action: "remove", ...(section === "moments" ? { target: source, index } : {}) }, "Photo removed.");
      }));
      list.append(card);
    });
    availability();
  };

  function renderQueue() {
    find("#queueSection").hidden = !queue.length;
    const target = replacement ? `moment ${replacement.index + 1}` : sections[section].title.toLowerCase();
    find("#queueTitle").textContent = `Ready for ${target}`;
    find("#uploadLabel").textContent = queue.length === 1 ? "Upload photo" : `Upload ${queue.length} photos`;
    find("#uploadProgressText").textContent = replacement ? "Replace selected photo" : `${queue.length} selected`;
    const list = find("#queueList");
    list.replaceChildren();
    queue.forEach((entry, index) => {
      const row = document.createElement("li");
      row.className = "queue-row";
      const image = new Image();
      image.src = entry.url;
      image.alt = `Selected photo ${index + 1}`;
      const info = document.createElement("div");
      info.className = "file-info";
      const name = document.createElement("strong");
      name.textContent = entry.file.name;
      const size = document.createElement("span");
      size.className = "muted";
      size.textContent = `${(entry.file.size / 1024 / 1024).toFixed(1)} MB`;
      info.append(name, size);
      const remove = actionButton("x", `Remove selected photo ${index + 1}`, () => {
        URL.revokeObjectURL(entry.url);
        queue.splice(index, 1);
        if (!queue.length) replacement = null;
        renderQueue();
      });
      delete remove.dataset.edit;
      remove.dataset.removeQueued = "";
      row.append(image, info, remove);
      list.append(row);
    });
    availability();
  }

  const selectFiles = async (files, target = null) => {
    if (busy || !unlocked || !ready || !files.length) return;
    if ((section !== "moments" || target) && files.length > 1) return notify("Choose one photo for this box.", "error");
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return notify("Choose JPG, PNG or WebP photos. Convert HEIC photos before uploading.", "error");
    if (files.some((file) => file.size > 20 * 1024 * 1024 || !file.size)) return notify("Each photo must be between 1 byte and 20 MB.", "error");
    if (section === "moments" && !target && currentSources().length + queue.length + files.length > 60) return notify("Our moments can contain up to 60 photos.", "error");
    const changedTarget = replacement?.target !== target?.target || replacement?.index !== target?.index;
    if (queue.length && changedTarget && !await confirmChange("Replace selected photos?", "The current selection has not been uploaded.", "Replace selection")) return;
    if (section !== "moments" || target || changedTarget) {
      queue.forEach((entry) => URL.revokeObjectURL(entry.url));
      queue = [];
    }
    replacement = target;
    queue.push(...files.map((file) => ({ file, url: URL.createObjectURL(file), requestId: crypto.randomUUID() })));
    renderQueue();
    notify(`${queue.length} ${queue.length === 1 ? "photo" : "photos"} ready for ${sections[section].title.toLowerCase()}.`, "info");
  };

  const preparePhoto = async (file) => {
    let decoded;
    let temporaryUrl;
    try {
      if (typeof createImageBitmap === "function") decoded = await createImageBitmap(file, { imageOrientation: "from-image" });
      else {
        temporaryUrl = URL.createObjectURL(file);
        decoded = new Image();
        decoded.src = temporaryUrl;
        await decoded.decode();
      }
      if (!decoded.width || !decoded.height || decoded.width * decoded.height > 60000000) throw new Error("Use a photo smaller than 60 megapixels.");
      const scale = Math.min(1, 1920 / Math.max(decoded.width, decoded.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not prepare this photo.");
      context.drawImage(decoded, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("This photo could not be prepared.")), "image/webp", .84));
      if (blob.size > 4 * 1024 * 1024) throw new Error("This photo is still too large. Choose a smaller version.");
      return { file: new File([blob], blob.type === "image/webp" ? "photo.webp" : "photo.png", { type: blob.type }), width: canvas.width, height: canvas.height, name: file.name };
    } catch (error) {
      if (error.name === "InvalidStateError" || error.name === "EncodingError") {
        const invalid = new Error(`Cannot read ${file.name}. Choose a valid JPG, PNG or WebP photo.`);
        invalid.status = 400;
        throw invalid;
      }
      error.status = 400;
      throw error;
    } finally {
      decoded?.close?.();
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
    }
  };

  find("#authForm").addEventListener("submit", (event) => {
    event.preventDefault();
    void perform(async () => {
      uploads = await send(section, { action: "verify" });
      unlocked = true;
      ready = true;
      password.type = "password";
      find("#togglePassword").setAttribute("aria-pressed", "false");
      find("#togglePassword").setAttribute("aria-label", "Show password");
      find("#togglePassword").title = "Show password";
      renderPhotos();
      find("#retryBtn").hidden = true;
      notify("Editing unlocked.");
    });
  });
  find("#togglePassword").addEventListener("click", () => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    find("#togglePassword").setAttribute("aria-pressed", String(show));
    find("#togglePassword").setAttribute("aria-label", show ? "Hide password" : "Show password");
    find("#togglePassword").title = show ? "Hide password" : "Show password";
  });
  find("#lockBtn").addEventListener("click", () => {
    unlocked = false;
    password.value = "";
    password.type = "password";
    find("#togglePassword").setAttribute("aria-pressed", "false");
    find("#togglePassword").setAttribute("aria-label", "Show password");
    find("#togglePassword").title = "Show password";
    clearQueue();
    availability();
    notify("Editing is locked.", "info");
  });
  all("[data-section]").forEach((button) => button.addEventListener("click", async () => {
    if (button.dataset.section === section) return;
    if (queue.length && !await confirmChange("Discard selected photos?", "These photos have not been uploaded yet.", "Discard selection")) return;
    clearQueue();
    section = button.dataset.section;
    renderPhotos();
    renderQueue();
  }));
  find("#chooseBtn").addEventListener("click", () => chooseFiles());
  fileInput.addEventListener("change", () => { void selectFiles([...fileInput.files], pickerTarget); });
  find("#clearQueueBtn").addEventListener("click", clearQueue);
  find("#retryBtn").addEventListener("click", loadPhotos);
  find("#restoreBtn").addEventListener("click", async () => {
    if (await confirmChange("Restore default photos?", `Custom photos in ${sections[section].title.toLowerCase()} will be replaced by the defaults in your configuration.`, "Restore defaults")) {
      clearQueue();
      await saveAction({ action: "clear" }, "Default photos restored.");
    }
  });
  find("#hideBtn").addEventListener("click", async () => {
    if (await confirmChange("Hide these photos?", `All photos in ${sections[section].title.toLowerCase()} will be removed from the invitation.`, "Hide photos")) {
      clearQueue();
      await saveAction({ action: "hide" }, "Photos hidden from the invitation.");
    }
  });
  const dropZone = find("#dropZone");
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!busy && ready && unlocked) dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
    void selectFiles([...event.dataTransfer.files], replacement);
  });
  find("#uploadBtn").addEventListener("click", () => perform(async () => {
    const selectedSection = section;
    const target = replacement ? { ...replacement } : {};
    const total = queue.length;
    let completed = 0;
    const progress = find("#progress");
    progress.max = total;
    progress.value = 0;
    progress.hidden = false;
    await [...queue].reduce((previous, entry) => previous.then(async () => {
      notify(`Preparing photo ${completed + 1} of ${total}...`, "info");
      const prepared = await preparePhoto(entry.file);
      notify(`Uploading photo ${completed + 1} of ${total} to ${sections[selectedSection].title.toLowerCase()}...`, "info");
      uploads = await send(selectedSection, { action: "upload", ...prepared, ...target, requestId: entry.requestId });
      URL.revokeObjectURL(entry.url);
      queue.shift();
      completed++;
      progress.value = completed;
      renderQueue();
      renderPhotos();
    }), Promise.resolve());
    replacement = null;
    fileInput.value = "";
    notify(`${completed} ${completed === 1 ? "photo" : "photos"} saved to ${sections[selectedSection].title.toLowerCase()}.`);
  }));
  addEventListener("beforeunload", (event) => {
    if (busy || queue.length) event.preventDefault();
  });
  renderPhotos();
  void loadPhotos();
})();