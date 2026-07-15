import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the H5 behind its loading gate", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>一脚踢出圈｜闽超声浪接力<\/title>/);
  assert.match(html, /正在集结闽超声浪/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /LOADING/);
  assert.match(html, /inert=""/);
});

test("keeps the experience fixed and gates entry on decoded assets", async () => {
  const [page, css, layout, pagesHtml] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
    readFile(new URL("github-pages/index.html", projectRoot), "utf8"),
  ]);

  assert.match(page, /const PRELOAD_ASSETS/);
  assert.match(page, /cache: "force-cache"/);
  assert.match(page, /document\.fonts\.ready/);
  assert.match(page, /setPreloadReady\(failures === 0\)/);
  assert.match(page, /requestFullscreen/);
  assert.match(page, /document\.addEventListener\("dblclick"/);
  assert.match(page, /document\.addEventListener\("touchmove"/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /user-select:\s*none/);
  assert.match(layout, /maximumScale:\s*1/);
  assert.match(layout, /userScalable:\s*false/);
  assert.match(pagesHtml, /maximum-scale=1, user-scalable=no/);
});

test("all local page assets exist", async () => {
  const sources = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
  ]);
  const assets = new Set(sources.join("\n").match(/\/assets\/[A-Za-z0-9_./-]+/g) ?? []);
  assert.ok(assets.size > 50);

  await Promise.all(
    [...assets].map((asset) => access(new URL(`public${asset}`, projectRoot))),
  );
});
