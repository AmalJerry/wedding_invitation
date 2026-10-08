import { test, expect } from "@playwright/test";
import { createImageHandler } from "../netlify/functions/images.mjs";
import { PhotoStore } from "./photo-store.mjs";

test.use({ baseURL: "http://localhost:8889", viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
test.setTimeout(60000);

const password = "browser-test-only";

const setup = async (context) => {
  const store = new PhotoStore();
  const handle = createImageHandler(store, () => password);
  const controls = { store, requests: [], nextStatus: 0, pauseUpload: null };
  const routeRequest = async (route) => {
    const incoming = route.request();
    const request = new Request(incoming.url(), { method: incoming.method(), headers: incoming.headers(), body: incoming.postDataBuffer() || undefined });
    if (incoming.method() === "POST") {
      const form = await request.clone().formData();
      controls.requests.push({ section: form.get("section"), action: form.get("action") || "upload", target: form.get("target"), file: form.get("file") });
      if (controls.nextStatus) {
        const status = controls.nextStatus;
        controls.nextStatus = 0;
        return route.fulfill({ status, body: status === 409 ? "Photos changed in another tab. Reload the photos and try again." : "Photo storage is unavailable. Please retry in a moment." });
      }
      if (form.get("action") === "upload" && controls.pauseUpload) await controls.pauseUpload;
    }
    const response = await handle(request);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  };
  await context.route("**/api/images", routeRequest);
  await context.route("**/img/*", routeRequest);
  return controls;
};

const samplePhoto = async (page, name, width, height) => {
  const base64 = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#c8d9ca";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#925c6b";
    context.fillRect(width / 4, height / 4, width / 2, height / 2);
    return canvas.toDataURL("image/png").split(",")[1];
  }, { width, height });
  return { name, mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
};

const unlock = async (page) => {
  await page.goto("/admin.html");
  await expect(page.locator("#password")).toBeEnabled();
  await page.getByLabel("Admin password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Unlock editing", exact: true }).click();
  await expect(page.locator("#unlockedPanel")).toBeVisible();
};

const selectPhoto = async (page, button, files) => {
  const selected = page.waitForEvent("filechooser");
  await button.click();
  const chooser = await selected;
  await chooser.setFiles(files);
  await expect(page.locator("#queueSection")).toBeVisible();
};

test("invitation renders without overflow, supports keyboard controls, and keeps natural photo ratios", async ({ page, context }, testInfo) => {
  await setup(context);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?to=Guest%20%26%20Family");
  await expect(page.locator("[data-guest]")).toHaveText("Dear Guest & Family,");
  await expect(page.locator("main")).toHaveJSProperty("inert", true);
  await page.getByRole("button", { name: "Open invitation", exact: true }).press("Enter");
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await expect(page.locator("[data-hero]")).toHaveJSProperty("naturalWidth", 928);
  await expect(page.locator("#gallery")).toHaveCount(0);
  await expect(page.locator(".sec-num")).toHaveText(["01", "02", "03", "04", "05", "06"]);
  const paint = await page.locator("#scratch").evaluate((canvas) => canvas.getContext("2d").getImageData(10, 10, 1, 1).data[3]);
  expect(paint).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("invitation-desktop.png") });
  await page.locator("#revealDate").press("Enter");
  await expect(page.locator(".scratch")).toHaveClass(/done/);
  await expect(page.locator("#gcal")).toHaveAttribute("href", /20261102T110000Z/);
  await expect(page.locator("#wa")).toHaveAttribute("href", /Guest%20%26%20Family/);
  await page.locator("#grid button").first().click();
  await expect(page.locator("#lightbox")).toHaveJSProperty("open", true);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#lbImg")).toHaveAttribute("alt", /2 of 6/);
  await page.keyboard.press("Tab");
  expect(await page.locator("#lightbox").evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#lightbox")).toBeHidden();
  await expect(page.locator("#grid button").first()).toBeFocused();
  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#moments").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll("#grid img")].every((image) => image.complete && image.naturalWidth));
    const ratios = await page.locator("#grid img").evaluateAll((images) => images.map((image) => {
      const box = image.getBoundingClientRect();
      return Math.abs(box.width / box.height - image.naturalWidth / image.naturalHeight);
    }));
    expect(ratios.every((difference) => difference < .02)).toBe(true);
    if (width === 390) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath("invitation-mobile.png"), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test("admin uploads to exact boxes, preserves photo order, and updates the invitation", async ({ page, context }, testInfo) => {
  const controls = await setup(context);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await unlock(page);
  await selectPhoto(page, page.locator("#chooseBtn"), await samplePhoto(page, "landscape-cover.png", 1200, 600));
  await page.locator("#uploadBtn").click();
  await expect(page.locator("#message")).toHaveText("1 photo saved to cover photo.");
  await expect(page.locator(".photo-preview")).toHaveAttribute("data-orientation", "landscape");
  const guest = await context.newPage();
  await guest.goto("/?preview=1");
  await expect(guest.locator(".arch")).toHaveAttribute("data-orientation", "landscape");
  await expect(guest.locator("[data-hero]")).toHaveJSProperty("naturalWidth", 1200);

  await page.getByRole("button", { name: /Venue photo/ }).click();
  await selectPhoto(page, page.locator("#chooseBtn"), await samplePhoto(page, "portrait-venue.png", 600, 900));
  await page.locator("#uploadBtn").click();
  await expect(page.locator("#message")).toHaveText("1 photo saved to venue photo.");
  await guest.reload();
  await expect(guest.locator(".venue-img")).toHaveAttribute("data-orientation", "portrait");
  await expect(guest.locator(".arch")).toHaveAttribute("data-orientation", "landscape");

  await page.getByRole("button", { name: /Our moments/ }).click();
  await selectPhoto(page, page.getByRole("button", { name: "Replace moment 02", exact: true }), await samplePhoto(page, "square-moment.png", 640, 640));
  await expect(page.locator("#queueTitle")).toHaveText("Ready for moment 2");
  await page.locator("#uploadBtn").click();
  await expect(page.locator("#queueSection")).toBeHidden();
  await expect(page.locator(".photo-card")).toHaveCount(6);
  await expect(page.locator(".photo-name").nth(1)).toHaveText("square-moment.png");
  await page.getByRole("button", { name: "Move moment 02 earlier", exact: true }).click();
  await expect(page.locator(".photo-name").first()).toHaveText("square-moment.png");

  let release;
  controls.pauseUpload = new Promise((resolve) => { release = resolve; });
  const files = [await samplePhoto(page, "tall-moment.png", 400, 800), await samplePhoto(page, "wide-moment.png", 1200, 450)];
  await selectPhoto(page, page.locator("#chooseBtn"), files);
  await page.locator("#uploadBtn").click();
  await expect(page.locator("[data-section='venue']")).toBeDisabled();
  release();
  controls.pauseUpload = null;
  await expect(page.locator("#message")).toHaveText("2 photos saved to our moments.");
  await expect(page.locator(".photo-card")).toHaveCount(8);
  expect(controls.requests.filter((request) => request.action === "upload").map((request) => request.section)).toEqual(["hero", "venue", "moments", "moments", "moments"]);
  expect(controls.requests.filter((request) => request.file).every((request) => request.file.size < 4 * 1024 * 1024)).toBe(true);
  await guest.reload();
  await expect(guest.locator("#grid button")).toHaveCount(8);
  await expect(guest.locator("#grid button").first()).toHaveAttribute("data-orientation", "square");

  await page.getByRole("button", { name: "Remove moment 01", exact: true }).click();
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(page.locator(".photo-card")).toHaveCount(7);
  await page.locator("#hideBtn").click();
  await page.getByRole("button", { name: "Hide photos", exact: true }).click();
  await expect(page.locator("#emptyState")).toBeVisible();
  await guest.reload();
  await expect(guest.locator("#moments")).toBeHidden();
  await expect(guest.locator(".dock a[href='#moments']")).toBeHidden();
  await page.locator("#restoreBtn").click();
  await page.locator("#confirmAction").click();
  await expect(page.locator(".photo-card")).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath("admin-desktop.png"), fullPage: true });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: testInfo.outputPath("admin-mobile.png"), fullPage: true });
  }
  await page.locator("#lockBtn").click();
  await expect(page.locator("#password")).toHaveValue("");
  await expect(page.locator("#chooseBtn")).toBeDisabled();
  expect(errors).toEqual([]);
});

test("failed uploads, canceled pickers and stale saves preserve safe editing state", async ({ page, context }) => {
  const controls = await setup(context);
  await page.goto("/admin.html");
  await page.locator("#password").fill("incorrect");
  await page.locator("#unlockBtn").click();
  await expect(page.locator("#message")).toContainText("Incorrect password");
  await expect(page.locator("#chooseBtn")).toBeDisabled();
  await page.locator("#password").fill(password);
  await page.locator("#unlockBtn").click();
  await expect(page.locator("#unlockedPanel")).toBeVisible();
  await page.getByRole("button", { name: /Our moments/ }).click();
  await selectPhoto(page, page.getByRole("button", { name: "Replace moment 02", exact: true }), await samplePhoto(page, "exact-box.png", 500, 750));
  const canceledPicker = page.waitForEvent("filechooser");
  await page.locator("#chooseBtn").click();
  await canceledPicker;
  await expect(page.locator("#queueTitle")).toHaveText("Ready for moment 2");
  await page.getByRole("button", { name: /Venue photo/ }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#sectionTitle")).toHaveText("Our moments");
  controls.nextStatus = 503;
  await page.locator("#uploadBtn").click();
  await expect(page.locator("#retryBtn")).toBeVisible();
  await expect(page.locator("#queueSection")).toBeVisible();
  await page.locator("#retryBtn").click();
  await expect(page.locator("#uploadBtn")).toBeEnabled();
  await page.locator("#uploadBtn").click();
  await expect(page.locator(".photo-name").nth(1)).toHaveText("exact-box.png");
  await expect(page.locator(".photo-card")).toHaveCount(6);

  await selectPhoto(page, page.locator("#chooseBtn"), { name: "corrupt.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await page.locator("#uploadBtn").click();
  await expect(page.locator("#message")).toContainText("Cannot read");
  await expect(page.locator("#chooseBtn")).toBeEnabled();
  await page.locator("#clearQueueBtn").click();
  await selectPhoto(page, page.locator("#chooseBtn"), await samplePhoto(page, "stale.png", 600, 400));
  controls.nextStatus = 409;
  await page.locator("#uploadBtn").click();
  await expect(page.locator("#message")).toContainText("another tab");
  await expect(page.locator("#queueSection")).toBeHidden();
  await expect(page.locator("#chooseBtn")).toBeEnabled();
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

test("a stalled image service does not lock the invitation", async ({ page, context }) => {
  let release;
  const stalled = new Promise((resolve) => { release = resolve; });
  await context.route("**/api/images", async (route) => {
    await stalled;
    await route.fulfill({ status: 503, body: "Unavailable" });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open invitation", exact: true }).press("Enter");
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  await expect(page.locator("[data-groom]").last()).toHaveText("Abhimanyu");
  release();
  await expect(page.locator("[data-hero]")).toHaveJSProperty("naturalWidth", 928);
});