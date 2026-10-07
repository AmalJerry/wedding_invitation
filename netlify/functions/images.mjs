// Photo uploads from /admin.html, stored in Netlify Blobs.
// GET  /api/images      -> { hero, venue, gallery: [], moments: [] } (uploaded overrides)
// POST /api/images      -> upload one photo (form: password, section, file) or clear (action=clear)
// GET  /img/<key>       -> serves an uploaded photo
import { getStore } from "@netlify/blobs";

const SECTIONS = ["hero", "venue", "gallery", "moments"];
const LIST = "_index";

export default async (req) => {
  const store = getStore({ name: "photos", consistency: "strong" });
  const url = new URL(req.url);

  if (url.pathname.startsWith("/img/")) {
    const key = decodeURIComponent(url.pathname.slice(5));
    const hit = await store.getWithMetadata(key, { type: "stream" });
    if (!hit) return new Response("Not found", { status: 404 });
    return new Response(hit.data, {
      headers: { "Content-Type": hit.metadata.type || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  }

  const list = (await store.get(LIST, { type: "json" })) || { hero: "", venue: "", gallery: [], moments: [] };
  if (req.method === "GET") return Response.json(list, { headers: { "Cache-Control": "no-store" } });

  const form = await req.formData();
  if (!process.env.ADMIN_PASSWORD || form.get("password") !== process.env.ADMIN_PASSWORD)
    return new Response("Wrong password (set ADMIN_PASSWORD in Netlify environment variables)", { status: 401 });
  const section = form.get("section");
  if (!SECTIONS.includes(section)) return new Response("Unknown section", { status: 400 });

  const old = [].concat(list[section] || []);
  if (form.get("action") === "clear") {
    list[section] = Array.isArray(list[section]) ? [] : "";
  } else {
    const file = form.get("file");
    if (!file || !file.size) return new Response("No file", { status: 400 });
    const key = `${section}-${Date.now()}`;
    await store.set(key, await file.arrayBuffer(), { metadata: { type: file.type } });
    if (Array.isArray(list[section])) list[section].push(`img/${key}`);
    else list[section] = `img/${key}`;
  }
  await store.setJSON(LIST, list);
  // delete photos no longer used
  const now = [].concat(list[section] || []);
  await Promise.all(old.filter((p) => !now.includes(p)).map((p) => store.delete(p.slice(4))));
  return Response.json(list);
};

export const config = { path: ["/api/images", "/img/*"] };
