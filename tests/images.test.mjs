import test from "node:test";
import assert from "node:assert/strict";
import { createImageHandler } from "../netlify/functions/images.mjs";
import { PhotoStore } from "./photo-store.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=", "base64");
const password = "test-only-password";
const photo = () => new File([png], "portrait.png", { type: "image/png" });

const setup = () => {
  const store = new PhotoStore();
  return { store, handle: createImageHandler(store, () => password) };
};
const request = (values = {}) => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ password, section: "hero", ...values })) form.set(key, value);
  return new Request("https://invitation.test/api/images", { method: "POST", body: form });
};

test("public reads preserve legacy photo URLs and never cache the manifest", async () => {
  const { store, handle } = setup();
  await store.setJSON("_index", { hero: "img/hero-123", gallery: ["img/gallery-123"], moments: [] });
  const response = await handle(new Request("https://invitation.test/api/images"));
  const body = await response.json();
  assert.equal(body.hero, "img/hero-123");
  assert.deepEqual(body.gallery, ["img/gallery-123"]);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok(body.revision);
});

test("authentication rejects incorrect or unconfigured passwords without writes", async () => {
  const { store, handle } = setup();
  assert.equal((await handle(request({ password: "incorrect", file: photo() }))).status, 401);
  assert.equal((await createImageHandler(store, () => "")(request({ action: "verify" }))).status, 500);
  assert.equal(store.data.size, 0);
  assert.equal((await handle(request({ action: "verify" }))).status, 200);
  assert.equal(store.data.size, 0);
});

test("upload stores dimensions, replaces only its section, and removes the previous blob", async () => {
  const { store, handle } = setup();
  const first = await (await handle(request({ file: photo(), width: "600", height: "900" }))).json();
  assert.equal(first.metadata[first.hero].width, 600);
  assert.equal(first.metadata[first.hero].height, 900);
  const venue = await (await handle(request({ section: "venue", file: photo(), revision: first.revision }))).json();
  const last = await (await handle(request({ file: photo(), revision: venue.revision }))).json();
  assert.notEqual(last.hero, first.hero);
  assert.equal(last.venue, venue.venue);
  assert.equal(store.data.has(first.hero.slice(4)), false);
  assert.equal(last.overrides.hero, true);
});

test("moments support replacing an exact default slot, ordering and removal", async () => {
  const { handle } = setup();
  const base = ["images/first.png", "images/second.png"];
  const uploaded = await (await handle(request({ section: "moments", base: JSON.stringify(base), file: photo(), target: base[1], index: "1" }))).json();
  assert.equal(uploaded.moments.length, 2);
  assert.equal(uploaded.moments[0], base[0]);
  const ordered = await (await handle(request({ section: "moments", action: "reorder", order: JSON.stringify([...uploaded.moments].reverse()), revision: uploaded.revision }))).json();
  assert.equal(ordered.moments[1], base[0]);
  const removed = await (await handle(request({ section: "moments", action: "remove", target: ordered.moments[0], index: "0", revision: ordered.revision }))).json();
  assert.deepEqual(removed.moments, [base[0]]);
});

test("removing the final moment hides it; restore defaults removes the override", async () => {
  const { handle } = setup();
  const uploaded = await (await handle(request({ section: "moments", file: photo() }))).json();
  const removed = await (await handle(request({ section: "moments", action: "remove", target: uploaded.moments[0], index: "0" }))).json();
  assert.deepEqual(removed.moments, []);
  assert.equal(removed.overrides.moments, true);
  const restored = await (await handle(request({ section: "moments", action: "clear" }))).json();
  assert.equal(restored.overrides.moments, undefined);
});

test("retrying an upload does not create a duplicate even with an old revision", async () => {
  const { handle } = setup();
  const values = { section: "moments", file: photo(), requestId: "repeatable-upload-id", revision: "" };
  const first = await (await handle(request(values))).json();
  const second = await (await handle(request(values))).json();
  assert.deepEqual(second.moments, first.moments);
  assert.equal(second.revision, first.revision);
});

test("stale and concurrent writes cannot overwrite another save", async () => {
  const { handle, store } = setup();
  const responses = await Promise.all([
    handle(request({ file: photo(), revision: "", requestId: "concurrent-first" })),
    handle(request({ file: photo(), revision: "", requestId: "concurrent-second" })),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const current = await (await handle(new Request("https://invitation.test/api/images"))).json();
  assert.ok(store.data.has(current.hero.slice(4)));
  assert.equal((await handle(request({ action: "clear", revision: "stale" }))).status, 409);
});

test("rejects SVG, spoofed content, oversized files, invalid dimensions and bad sections", async () => {
  const { store, handle } = setup();
  const cases = [
    [{ file: new File(["<svg></svg>"], "image.svg", { type: "image/svg+xml" }) }, 400],
    [{ file: new File(["not an image"], "image.jpg", { type: "image/jpeg" }) }, 400],
    [{ file: new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }) }, 413],
    [{ file: photo(), width: "900", height: "-1" }, 400],
    [{ file: photo(), section: "gallery" }, 400],
    [{ file: photo(), action: "unknown" }, 400],
    [{ section: "moments", file: photo(), base: '["javascript:alert(1)"]' }, 400],
  ];
  for (const [values, status] of cases) assert.equal((await handle(request(values))).status, status);
  assert.equal(store.data.size, 0);
});

test("malformed requests and invalid ordering do not alter photos", async () => {
  const { handle } = setup();
  assert.equal((await handle(new Request("https://invitation.test/api/images", { method: "POST", body: "bad" }))).status, 400);
  assert.equal((await handle(new Request("https://invitation.test/api/images", { method: "DELETE" }))).status, 405);
  assert.equal((await handle(request({ section: "moments", action: "reorder", order: '["images/unknown.png"]' }))).status, 400);
});

test("image URLs cannot expose the manifest and set safe immutable image headers", async () => {
  const { handle } = setup();
  const list = await (await handle(request({ file: photo() }))).json();
  const response = await handle(new Request("https://invitation.test/" + list.hero));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal((await handle(new Request("https://invitation.test/img/_index"))).status, 404);
  assert.equal((await handle(new Request("https://invitation.test/img/%"))).status, 400);
  const head = await handle(new Request("https://invitation.test/" + list.hero, { method: "HEAD" }));
  assert.equal(await head.text(), "");
});

test("cleanup failure does not report a completed save as failed", async () => {
  const { handle, store } = setup();
  await handle(request({ file: photo() }));
  store.delete = async () => { throw new Error("Storage temporarily unavailable"); };
  const response = await handle(request({ action: "clear" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).hero, "");
});