#!/usr/bin/env node
// Takes a folder-per-product of photographs, names them to the convention,
// uploads them to Shopify Files, and fills the sheet's Photos column.
//
//   npm run photos:plan                      # what it would do, sends nothing
//   npm run photos:upload                    # upload, print the Photos values
//   npm run photos:upload -- --write         # ...and write them into the sheet
//
//   --photos <dir>   where the per-product folders live
//   --sheet  <csv>   the fill sheet (default: the shipped template)
//
// WHY FOLDERS AND NOT FILENAMES. Photographs arrive from a shoot named
// IMG_4821.HEIC or "WhatsApp Image 2026-08-15 at 8.11.24 PM.jpeg". Renaming six
// hundred of those by hand is the kind of job that gets done wrong in the last
// hour. Dropping them into a folder named after the product is a job anyone can
// do while looking at the photographs, and the naming is then derived:
//
//     Girlyf Assets/Geo Lariat Necklace/anything.jpg
//       -> girlyf-necklaces-geo-lariat-necklace-1.jpg
//
// The category comes from the SHEET, not the folder, so nobody files a photo
// under a category that disagrees with the product's own.
//
// ORDER IS FILENAME ORDER within a folder. Rename to 1,2,3 inside the folder if
// a particular shot must lead; the first photo is the one shown everywhere.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { parseCsv, toCsv } from '../lib/csv.mjs';
import { validate, slugify, CATEGORIES, COMBO } from '../lib/fill-sheet.mjs';
import {
  loadEnv, require_, createClient, apiVersion,
  normaliseStore, EXPECTED_STORE, ROOT,
} from './client.mjs';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };

const DRY_RUN = has('--dry-run');
const WRITE = has('--write');
const SHEET = valueOf('--sheet') || 'sheet/girlyf-fill-sheet-template.csv';
const PHOTOS = valueOf('--photos') || join(ROOT, '../Girlyf Assets');

const log = (m) => console.log(m);
const step = (m) => console.log(`  ${m}`);

const IMAGE = /\.(jpe?g|png|webp)$/i;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// --- the sheet decides which products exist, and their categories -----------

if (!existsSync(SHEET)) {
  console.error(`\nNo sheet at ${SHEET}. Pass --sheet <csv>.\n`);
  process.exit(2);
}
const { records, headers } = parseCsv(readFileSync(SHEET, 'utf8'));
const { errors } = validate(records);
// Photos errors are the thing this script is here to fix, so ignore those only.
const blocking = errors.filter((e) => e.column !== 'Photos');
if (blocking.length) {
  console.error('\nThe sheet does not validate, so its categories cannot be trusted:\n');
  for (const e of blocking.slice(0, 10)) console.error(`  row ${e.line}  ${e.column}: ${e.message}`);
  console.error('');
  process.exit(2);
}

/** One entry per product, not per sheet row: a sized ring is three rows. */
const products = [];
const seen = new Set();
for (const row of records) {
  const name = row['Product Name'];
  if (seen.has(name)) continue;
  seen.add(name);
  const handle = slugify(name);
  const category = row.Category === COMBO ? 'combo' : row.Category;
  products.push({ name, handle, category, row });
}

// --- match each product to its folder ---------------------------------------

if (!existsSync(PHOTOS)) {
  console.error(`\nNo photo folder at ${PHOTOS}. Pass --photos <dir>.\n`);
  process.exit(2);
}

const folders = readdirSync(PHOTOS)
  .filter((f) => !f.startsWith('.') && statSync(join(PHOTOS, f)).isDirectory());
const folderBySlug = new Map(folders.map((f) => [slugify(f), f]));

for (const product of products) {
  const folder = folderBySlug.get(product.handle);
  product.folder = folder || null;
  product.files = folder
    ? readdirSync(join(PHOTOS, folder)).filter((f) => IMAGE.test(f) && !f.startsWith('.')).sort()
    : [];
  product.named = product.files.map((file, i) =>
    `girlyf-${product.category}-${product.handle}-${i + 1}${extname(file).toLowerCase() === '.png' ? '.png' : '.jpg'}`);
}

// --- report ------------------------------------------------------------------

log(`\n${DRY_RUN ? 'PLAN (nothing will be sent)' : 'UPLOAD'}`);
log(`Sheet:  ${SHEET}`);
log(`Photos: ${PHOTOS}`);
log(`\nProducts (${products.length})`);

const withPhotos = products.filter((p) => p.files.length);
const without = products.filter((p) => !p.files.length);

for (const p of withPhotos) {
  step(`${p.handle.padEnd(30)} ${String(p.files.length).padStart(2)} photo(s)  <- ${p.folder}/`);
  for (let i = 0; i < p.files.length; i += 1) step(`    ${p.files[i].slice(0, 42).padEnd(44)} -> ${p.named[i]}`);
}
for (const p of without) {
  step(`${p.handle.padEnd(30)}  no folder named "${p.name}"`);
}

// A folder nobody claimed is almost always a typo in a name, and its
// photographs would otherwise be dropped without a word.
const claimed = new Set(products.map((p) => p.folder).filter(Boolean));
const orphans = folders.filter((f) => !claimed.has(f));
if (orphans.length) {
  log(`\nFolders with no product in the sheet (${orphans.length}):`);
  for (const f of orphans) {
    const count = readdirSync(join(PHOTOS, f)).filter((x) => IMAGE.test(x)).length;
    step(`${f.padEnd(40)} ${count} photo(s) will be IGNORED`);
  }
  log('Either the folder is misspelt, or the product is missing from the sheet.');
}

const total = withPhotos.reduce((n, p) => n + p.files.length, 0);

// Competitors run on one or two photographs per product; five is above the norm
// and costs page weight on a phone. Worth saying, not worth refusing.
const many = withPhotos.filter((p) => p.files.length > 3);
if (many.length) {
  log(`\n${many.length} product(s) carry more than three photographs.`);
  log('Thauya and Aleisha ship one, The Beige two. More is allowed, just rarely read.');
}

if (DRY_RUN) {
  log(`\nWould upload ${total} photo(s) for ${withPhotos.length} product(s).\n`);
  process.exit(0);
}

// --- upload ------------------------------------------------------------------

const env = loadEnv();
const store = normaliseStore(env.SHOPIFY_STORE || '');
if (store !== EXPECTED_STORE) {
  console.error(`\nSHOPIFY_STORE is "${store}", but this repo is for ${EXPECTED_STORE}.\n`);
  process.exit(2);
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
      files { id fileStatus }
      userErrors { field message }
    }
  }`;

/** Filenames already in Files, so a second run uploads nothing twice. */
const existing = new Set();
let cursor = null;
do {
  const page = await gql(
    `query($after: String) { files(first: 250, after: $after) { pageInfo { hasNextPage endCursor }
      nodes { ... on MediaImage { image { url } } ... on Video { filename } } } }`,
    { after: cursor },
  );
  for (const n of page.files.nodes) {
    if (n.filename) { existing.add(n.filename); continue; }
    const url = n.image?.url;
    if (url) existing.add(decodeURIComponent(new URL(url).pathname.split('/').pop()));
  }
  cursor = page.files.pageInfo.hasNextPage ? page.files.pageInfo.endCursor : null;
} while (cursor);

log('\nUploading');
let uploaded = 0;
for (const p of withPhotos) {
  for (let i = 0; i < p.files.length; i += 1) {
    const as = p.named[i];
    if (existing.has(as)) { step(`exists   ${as}`); continue; }

    const path = join(PHOTOS, p.folder, p.files[i]);
    const bytes = readFileSync(path);
    const mimeType = MIME[extname(as).toLowerCase()];

    const [target] = (await gql(STAGED, {
      input: [{ resource: 'IMAGE', filename: as, mimeType, httpMethod: 'POST', fileSize: String(bytes.length) }],
    })).stagedUploadsCreate.stagedTargets;

    const form = new FormData();
    for (const param of target.parameters) form.append(param.name, param.value);
    form.append('file', new Blob([bytes], { type: mimeType }), as);
    const res = await fetch(target.url, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`${as}: ${res.status} ${res.statusText}`);

    await gql(FILE_CREATE, {
      files: [{ originalSource: target.resourceUrl, filename: as, alt: p.name, contentType: 'IMAGE' }],
    });
    step(`uploaded ${as}`);
    uploaded += 1;
  }
}

// --- hand back the Photos column ---------------------------------------------

log(`\nUploaded ${uploaded}, already present ${total - uploaded}.`);
log('\nPhotos column values:');
for (const p of withPhotos) log(`  ${p.name}\n    ${p.named.join(',')}`);

if (WRITE) {
  const byName = new Map(withPhotos.map((p) => [p.name, p.named.join(',')]));
  for (const row of records) {
    // Only the lead row of a product carries its photographs.
    const value = byName.get(row['Product Name']);
    if (value === undefined) continue;
    row.Photos = byName.get(row['Product Name']);
    byName.set(row['Product Name'], '');
  }
  const clean = records.map((r) => Object.fromEntries(headers.map((h) => [h, r[h] ?? ''])));
  writeFileSync(SHEET, toCsv(headers, clean));
  log(`\nWritten into ${SHEET}.`);
} else {
  log('\nPaste those into the Photos column, or re-run with --write to do it here.');
}
log('');
