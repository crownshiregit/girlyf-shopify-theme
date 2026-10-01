#!/usr/bin/env node
// Uploads the files the THEME references by name, and attaches reels to products.
//
//   npm run files:plan     # --dry-run
//   npm run files:upload
//
// WHY THIS EXISTS. `shopify://shop_images/girlyf-home-hero.jpg` resolves against
// Content -> Files by FILENAME. If the file is absent, Liquid renders nothing and
// reports nothing: the hero simply has no background. Every missing file in this
// manifest was a section that looked broken for a reason no error ever stated.
//
// IDEMPOTENT. A filename already in Files is left alone.

import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute, extname, basename } from 'node:path';
import {
  loadEnv, require_, createClient, apiVersion,
  normaliseStore, EXPECTED_STORE, ROOT,
} from './client.mjs';

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const valueOf = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };

const log = (m) => console.log(m);
const step = (m) => console.log(`  ${m}`);

const spec = JSON.parse(readFileSync(join(ROOT, 'scripts/shopify-data/content/theme-files.json'), 'utf8'));
const assetsFolder = valueOf('--assets') || '../Girlyf Assets';
const ASSETS = isAbsolute(assetsFolder) ? assetsFolder : join(ROOT, assetsFolder);

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

const sourceOf = (item) =>
  item.derived ? join(ROOT, item.derived) : join(ASSETS, item.from);

const env = loadEnv();
const store = normaliseStore(env.SHOPIFY_STORE || '');
if (store !== EXPECTED_STORE) {
  console.error(`\nSHOPIFY_STORE is "${store}", but this repo is for ${EXPECTED_STORE}.\n`);
  process.exit(2);
}

// --- every source must exist before anything is sent ------------------------
const all = [...spec.images, ...spec.reels];
const missing = all.filter((i) => !existsSync(sourceOf(i)));
if (missing.length) {
  console.error('\nMissing sources:\n');
  for (const i of missing) console.error(`  ${i.as.padEnd(26)} <- ${sourceOf(i)}`);
  console.error('');
  process.exit(2);
}

log(`\n${DRY_RUN ? 'PLAN (nothing will be sent)' : 'UPLOAD'} -> ${store}`);

if (DRY_RUN) {
  for (const i of spec.images) step(`image  ${i.as.padEnd(26)} <- ${basename(sourceOf(i))}`);
  for (const i of spec.reels) step(`reel   ${i.as.padEnd(26)} -> ${i.product}`);
  log(`\nWould upload ${all.length} files.\n`);
  process.exit(0);
}

const [token] = require_(env, ['SHOPIFY_ADMIN_TOKEN']);
const gql = createClient({ store, token, version: apiVersion(env) });

const STAGED = `
  mutation($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }`;

const FILE_CREATE = `
  mutation($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id fileStatus ... on MediaImage { image { url } } ... on Video { id } }
      userErrors { field message }
    }
  }`;

/** Filenames already in Files, so a second run is a no-op. */
const existingNames = new Set();
let cursor = null;
do {
  const page = await gql(
    `query($after: String) { files(first: 250, after: $after) { pageInfo { hasNextPage endCursor }
      nodes { ... on MediaImage { image { url } } ... on Video { filename } ... on GenericFile { url } } } }`,
    { after: cursor },
  );
  for (const n of page.files.nodes) {
    if (n.filename) { existingNames.add(n.filename); continue; }
    const url = n.image?.url || n.url;
    if (url) existingNames.add(decodeURIComponent(new URL(url).pathname.split('/').pop()).split('?')[0]);
  }
  cursor = page.files.pageInfo.hasNextPage ? page.files.pageInfo.endCursor : null;
} while (cursor);

// Shopify appends a hash to stored filenames, so compare on the stem.
const stem = (name) => name.replace(/\.[^.]+$/, '');
const alreadyThere = (name) => [...existingNames].some((e) => stem(e).startsWith(stem(name)));

const upload = async (item, kind) => {
  const path = sourceOf(item);
  const bytes = readFileSync(path);
  const mimeType = MIME[extname(item.as).toLowerCase()];
  const resource = kind === 'reel' ? 'VIDEO' : 'IMAGE';

  const [target] = (await gql(STAGED, {
    input: [{ resource, filename: item.as, mimeType, httpMethod: 'POST', fileSize: String(bytes.length) }],
  })).stagedUploadsCreate.stagedTargets;

  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([bytes], { type: mimeType }), item.as);
  const res = await fetch(target.url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`${item.as}: ${res.status} ${res.statusText}\n${(await res.text()).slice(0, 400)}`);

  const { fileCreate } = await gql(FILE_CREATE, {
    files: [{
      originalSource: target.resourceUrl,
      filename: item.as,
      alt: item.alt || '',
      contentType: kind === 'reel' ? 'VIDEO' : 'IMAGE',
    }],
  });
  return fileCreate.files[0];
};

log('\nImages');
for (const item of spec.images) {
  if (alreadyThere(item.as)) { step(`exists ${item.as}`); continue; }
  await upload(item, 'image');
  step(`uploaded ${item.as}`);
}

log('\nReels');
const reelIds = new Map();
for (const item of spec.reels) {
  if (alreadyThere(item.as)) { step(`exists ${item.as}`); continue; }
  const file = await upload(item, 'reel');
  reelIds.set(item.as, file.id);
  step(`uploaded ${item.as.padEnd(22)} -> ${item.product}`);
}

// ---------------------------------------------------------------------------
// Attach the reels to their products.
//
// Video is processed asynchronously, so a file is UPLOADED long before it is
// READY. Setting the metafield to a video that is still processing yields a
// strip that renders nothing, which is indistinguishable from no reels at all.
// So wait, rather than fire and hope.
// ---------------------------------------------------------------------------

log('\nAttaching reels');

const videoIdByName = async () => {
  const out = new Map();
  const d = await gql(`{ files(first: 250, query: "media_type:VIDEO") {
    nodes { ... on Video { id fileStatus filename } } } }`);
  for (const n of d.files.nodes) {
    if (!n?.id) continue;
    out.set(n.filename || n.id, { id: n.id, status: n.fileStatus, name: n.filename });
  }
  return out;
};

const PRODUCT_BY_HANDLE = `
  query($q: String!) { products(first: 1, query: $q) { nodes { id handle } } }`;

const METAFIELDS_SET = `
  mutation($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key }
      userErrors { field message }
    }
  }`;

let ready = new Map();
for (let attempt = 0; attempt < 20; attempt++) {
  ready = await videoIdByName();
  const pending = spec.reels.filter((r) => {
    const v = [...ready.values()].find((x) => x.name === r.as);
    return !v || v.status !== 'READY';
  });
  if (!pending.length) break;
  if (attempt === 0) step(`waiting for ${pending.length} video(s) to finish processing`);
  await new Promise((r) => setTimeout(r, 6000));
}

const byProduct = new Map();
for (const reel of spec.reels) {
  const v = [...ready.values()].find((x) => x.name === reel.as)
         || [...ready.values()].find((x) => x.name && stem(x.name).startsWith(stem(reel.as)));
  if (!v) { step(`SKIP  ${reel.as} not found in Files`); continue; }
  if (v.status !== 'READY') { step(`SKIP  ${reel.as} still ${v.status}`); continue; }
  if (!byProduct.has(reel.product)) byProduct.set(reel.product, []);
  byProduct.get(reel.product).push(v.id);
}

for (const [handle, ids] of byProduct) {
  const product = (await gql(PRODUCT_BY_HANDLE, { q: `handle:${handle}` })).products.nodes[0];
  if (!product) { step(`SKIP  no product ${handle}`); continue; }
  await gql(METAFIELDS_SET, {
    metafields: [{
      ownerId: product.id,
      namespace: 'custom',
      key: 'reels',
      type: 'list.file_reference',
      value: JSON.stringify(ids),
    }],
  });
  step(`${handle.padEnd(30)} ${ids.length} reel`);
}

log('');
