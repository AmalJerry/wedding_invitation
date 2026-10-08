import { getStore } from "@netlify/blobs";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

const SECTIONS = new Set(["hero", "venue", "moments"]);
const LIST = "_index";
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PHOTOS = 60;
const IMAGE_KEY = /^(hero|venue|gallery|moments)-[a-zA-Z0-9-]+$/;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const failure = (message, status) => new Response(message, { status, headers });
const reply = (list, revision = "") => Response.json({ ...list, revision }, { headers });
const readPassword = () => String(globalThis.Netlify?.env.get("ADMIN_PASSWORD") ?? process.env.ADMIN_PASSWORD ?? "").trim();
const hash = (value) => createHash("sha256").update(value).digest();
const paths = (list) => [list.hero, list.venue, ...(list.gallery || []), ...(list.moments || [])].filter(Boolean);
const isUploaded = (source) => typeof source === "string" && source.startsWith("img/") && IMAGE_KEY.test(source.slice(4));
const validSource = (source) => {
  if (typeof source !== "string" || !source || source.length > 2048) return false;
  try {
    const url = new URL(source, "https://default.invalid/");
    if (!["https:", "http:"].includes(url.protocol)) return false;
    return url.origin !== "https://default.invalid" || url.pathname.startsWith("/images/") || isUploaded(source);
  } catch { return false; }
};
const imageType = (bytes) => {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return "";
};

class PhotoError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const authenticate = async (request, getPassword) => {
  if (Number(request.headers.get("content-length")) > MAX_BYTES + 128 * 1024) throw new PhotoError("The photo is too large. Upload a file smaller than 4 MB.", 413);
  let form;
  try { form = await request.formData(); } catch { throw new PhotoError("Invalid upload request"); }
  const expected = getPassword().trim();
  if (!expected) throw new PhotoError("ADMIN_PASSWORD is not set for Functions. Add it in Netlify environment variables, then redeploy.", 500);
  if (!timingSafeEqual(hash(String(form.get("password") || "").trim()), hash(expected))) throw new PhotoError("Incorrect password. Please try again.", 401);
  return form;
};

const serveImage = async (store, request, url) => {
  if (request.method === "POST") throw new PhotoError("Method not allowed", 405);
  let key;
  try { key = decodeURIComponent(url.pathname.slice(5)); } catch { throw new PhotoError("Invalid image URL"); }
  if (!IMAGE_KEY.test(key)) throw new PhotoError("Not found", 404);
  const hit = await store.getWithMetadata(key, { type: "stream" });
  if (!hit || !TYPES.has(hit.metadata.type)) throw new PhotoError("Not found", 404);
  return new Response(request.method === "HEAD" ? null : hit.data, {
    headers: { "Content-Type": hit.metadata.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
};

const photoList = (value) => {
  let list;
  try { list = JSON.parse(value); } catch { throw new PhotoError("Invalid photo list"); }
  if (!Array.isArray(list) || list.length > MAX_PHOTOS || !list.every(validSource)) throw new PhotoError("Invalid photo list");
  return list;
};

const operationFrom = (form) => {
  const section = form.get("section");
  const action = form.get("action") || "upload";
  if (!SECTIONS.has(section)) throw new PhotoError("Unknown photo section");
  if (!["upload", "clear", "remove", "reorder", "hide"].includes(action)) throw new PhotoError("Unknown photo action");
  const requestId = String(form.get("requestId") || randomUUID());
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(requestId)) throw new PhotoError("Invalid upload identifier");
  const key = `${section}-${requestId}`;
  return { section, action, key, uploadedPath: `img/${key}`, target: form.get("target"), index: Number(form.get("index")) };
};

const checkSelection = (list, form, operation, revision) => {
  if (form.has("revision") && form.get("revision") !== revision) throw new PhotoError("Photos changed in another tab. Reload the photos and try again.", 409);
  const { section, target, index } = operation;
  if (section === "moments" && !list.overrides.moments && !list.moments.length && form.has("base")) list.moments = photoList(form.get("base"));
  if (target && (section !== "moments" || !form.has("index") || !Number.isInteger(index) || list.moments[index] !== target)) throw new PhotoError("This photo has changed. Reload the photos and try again.", 409);
};

const photoDimensions = (form) => {
  if (!form.has("width") && !form.has("height")) return {};
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  if (![width, height].every((size) => Number.isInteger(size) && size > 0 && size <= 20000)) throw new PhotoError("Invalid image dimensions");
  return { width, height };
};

const readImage = async (form) => {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new PhotoError("Choose a photo first");
  if (file.size > MAX_BYTES) throw new PhotoError("The photo is too large. Upload a file smaller than 4 MB.", 413);
  if (!TYPES.has(file.type)) throw new PhotoError("Use a JPG, PNG or WebP image.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (imageType(bytes) !== file.type) throw new PhotoError("This file is not a valid JPG, PNG or WebP image.");
  return { bytes, type: file.type, metadata: { name: String(form.get("name") || file.name).slice(0, 160), ...photoDimensions(form) } };
};

const uploadPhoto = async (store, list, form, operation) => {
  const { section, target, index, key, uploadedPath } = operation;
  if (section === "moments" && !target && list.moments.length >= MAX_PHOTOS) throw new PhotoError("The moments section can contain up to 60 photos.");
  const image = await readImage(form);
  await store.set(key, image.bytes, { metadata: { type: image.type } });
  list.metadata[uploadedPath] = image.metadata;
  if (section === "moments") {
    if (target) list.moments[index] = uploadedPath;
    else list.moments.push(uploadedPath);
  } else list[section] = uploadedPath;
  list.overrides[section] = true;
};

const reorderPhotos = (list, form, section) => {
  if (section !== "moments") throw new PhotoError("Only moments can be reordered");
  const order = photoList(form.get("order"));
  if (order.length !== list.moments.length) throw new PhotoError("The photo order does not match the current photos");
  const counts = new Map();
  list.moments.forEach((source) => counts.set(source, (counts.get(source) || 0) + 1));
  for (const source of order) {
    if (!counts.get(source)) throw new PhotoError("The photo order does not match the current photos");
    counts.set(source, counts.get(source) - 1);
  }
  list.moments = order;
  list.overrides.moments = true;
};

const applyChange = async (store, list, form, operation) => {
  const { section, action, target, index } = operation;
  switch (action) {
    case "upload":
      await uploadPhoto(store, list, form, operation);
      return;
    case "clear":
    case "hide":
      list[section] = section === "moments" ? [] : "";
      if (action === "clear") delete list.overrides[section];
      else list.overrides[section] = true;
      return;
    case "remove":
      if (section === "moments") {
        if (!target) throw new PhotoError("Choose a photo to remove");
        list.moments.splice(index, 1);
      } else list[section] = "";
      list.overrides[section] = true;
      return;
    case "reorder":
      reorderPhotos(list, form, section);
  }
};

const commitChanges = async (store, list, operation, revision, oldPaths) => {
  const currentPaths = paths(list);
  for (const source of Object.keys(list.metadata)) if (!currentPaths.includes(source)) delete list.metadata[source];
  delete list.revision;
  const result = await store.setJSON(LIST, list, revision ? { onlyIfMatch: revision } : { onlyIfNew: true });
  if (!result.modified) {
    if (operation.action === "upload") {
      const latest = await store.getWithMetadata(LIST, { type: "json" });
      if (!paths(latest?.data || {}).includes(operation.uploadedPath)) await Promise.allSettled([store.delete(operation.key)]);
    }
    throw new PhotoError("Photos changed in another tab. Reload the photos and try again.", 409);
  }
  await Promise.allSettled(oldPaths.filter((source) => isUploaded(source) && !currentPaths.includes(source)).map((source) => store.delete(source.slice(4))));
  return reply(list, result.etag);
};

export const createImageHandler = (store, getPassword = readPassword) => async (request) => {
  try {
    const url = new URL(request.url);
    if (!["GET", "HEAD", "POST"].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: { ...headers, Allow: "GET, HEAD, POST" } });
    if (url.pathname.startsWith("/img/")) return await serveImage(store, request, url);
    const form = request.method === "POST" ? await authenticate(request, getPassword) : null;
    const snapshot = await store.getWithMetadata(LIST, { type: "json" });
    const list = { hero: "", venue: "", gallery: [], moments: [], ...snapshot?.data };
    list.metadata = { ...list.metadata };
    list.overrides = { ...list.overrides };
    const revision = snapshot?.etag || "";
    if (request.method === "HEAD") return new Response(null, { headers });
    if (request.method === "GET" || form.get("action") === "verify") return reply(list, revision);
    const operation = operationFrom(form);
    if (operation.action === "upload" && paths(list).includes(operation.uploadedPath)) return reply(list, revision);
    const oldPaths = paths(list);
    checkSelection(list, form, operation, revision);
    await applyChange(store, list, form, operation);
    return await commitChanges(store, list, operation, revision, oldPaths);
  } catch (error) {
    if (error instanceof PhotoError) return failure(error.message, error.status);
    return failure("Photo storage is unavailable. Please retry in a moment.", 503);
  }
};

export default async function images(request) {
  try { return await createImageHandler(getStore({ name: "photos", consistency: "strong" }))(request); }
  catch { return failure("Photo storage is unavailable. Please retry in a moment.", 503); }
}

export const config = { path: ["/api/images", "/img/*"] };
