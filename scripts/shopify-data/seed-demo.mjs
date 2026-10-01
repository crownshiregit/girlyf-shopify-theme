#!/usr/bin/env node
// Seeds five demo products WITH PHOTOGRAPHS, for the pre-handover walkthrough.
//
//   npm run demo:plan          # --dry-run: validates and prints, sends nothing
//   npm run demo:seed          # creates them, uploads media, publishes
//   npm run demo:seed -- --undo    # deletes exactly what it created
//
// WHY THIS EXISTS AND THE FILL SHEET DOES NOT COVER IT. Shopify's product CSV
// has no usable image column — `Image Src` wants a public URL, which a folder on
// a laptop is not. So the sheet is words and numbers, and media is added in the
// admin by hand. That is the right shape for Girlyf filling a catalogue; it is
// the wrong shape for showing them a working storefront before they own it. This
// script is the developer-side exception, not a second way in.
// See decisions/media-is-added-in-the-admin.md.
//
// THE DEMO GOES THROUGH THE REAL DERIVATION. Handles, tags, SKUs, product type
// and the free_size metafield come from `toShopifyRows()` in scripts/lib —
// the same function the fill-sheet CSV path uses, called with fill-sheet-shaped
// records that are run through the same `validate()` first. A demo that derived
// its own tags would be demonstrating something the store does not do.
//
// ADDITIVE. An existing product with the same handle is left alone unless
// --force. The only destructive path is --undo, which is double-guarded: it
// deletes a product only if it BOTH carries the demo tag AND has the title
// prefix.

import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute, extname } from 'node:path';
import {
  loadEnv, require_, createClient, apiVersion,
  normaliseStore, EXPECTED_STORE, ROOT,
} from './client.mjs';
import { validate, toShopifyRows, CATEGORIES } from '../lib/fill-sheet.mjs';

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
  const at = argv.indexOf(flag);
  return at === -1 ? null : argv[at + 1];
};

const DRY_RUN = has('--dry-run');
const UNDO = has('--undo');
const FORCE = has('--force');

const log = (m) => console.log(m);
const step = (m) => console.log(`  ${m}`);

// ---------------------------------------------------------------------------
// The demo data, and the assets beside it
// ---------------------------------------------------------------------------

const spec = JSON.parse(
  readFileSync(join(ROOT, 'scripts/shopify-data/content/demo-products.json'), 'utf8'),
);

const assetsFolder = valueOf('--assets') || spec.assets_folder;
const ASSETS = isAbsolute(assetsFolder) ? assetsFolder : join(ROOT, assetsFolder);

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// ---------------------------------------------------------------------------
// Derive through the fill-sheet contract, so the demo cannot drift from it
// ---------------------------------------------------------------------------

/** The demo JSON, reshaped into the columns the fill sheet would have held. */
const asFillSheetRecords = (products) =>
  products.map((product, index) => ({
    _line: index + 2,
    'Product Name': product.title,
    Category: product.category,
    Material: product.material,
    'Material 2': product.material_2 || '',
    Size: product.size || '',
    Price: String(product.price),
    'Compare At': product.compare_at ? String(product.compare_at) : '',
    Stock: String(product.stock),
    Description: product.description,
    'Combo Contains': product.combo_contains || '',
    // Demo products are meant to be looked at, so they go live.
    Status: 'Active',
  }));

const records = asFillSheetRecords(spec.products);
const { errors, warnings } = validate(records);

if (errors.length) {
  console.error('\ndemo-products.json breaks the fill sheet contract:\n');
  for (const e of errors) console.error(`  product ${e.line - 1}  ${e.column}: ${e.message}`);
  console.error('\nFix the JSON. The demo obeys the same rules as the sheet, deliberately.\n');
  process.exit(2);
}

const rows = toShopifyRows(records);

// Every demo product here is single-variant, which the contract already
// guarantees: nothing but rings may carry a Size, and the only ring in the file
// is Free Size. Assert it rather than assume it — a future edit adding S/M/L
// would otherwise silently drop two variants.
const byHandle = new Map();
for (const row of rows) {
  if (!byHandle.has(row.Handle)) byHandle.set(row.Handle, []);
  byHandle.get(row.Handle).push(row);
}
const multiVariant = [...byHandle.entries()].filter(([, r]) => r.length > 1);
if (multiVariant.length) {
  console.error('\nThese demo products have more than one variant row:\n');
  for (const [handle] of multiVariant) console.error(`  ${handle}`);
  console.error(
    '\nThis seeder writes single-variant products only. Adding a sized ring means\n' +
      'teaching it productOptions with real option values — not a big change, but\n' +
      'not one to make by accident.\n',
  );
  process.exit(2);
}

/** Pair each derived row back up with its images and its source product. */
const planned = rows.map((row, index) => {
  const source = spec.products[index];
  const images = (source.images || []).map((image) => ({
    ...image,
    path: join(ASSETS, image.file),
  }));
  return { row, source, images };
});

// ---------------------------------------------------------------------------
// Store guard — the house rule, and worth keeping for a script that writes
// ---------------------------------------------------------------------------

const env = loadEnv();
const store = normaliseStore(env.SHOPIFY_STORE || '');

if (store !== EXPECTED_STORE) {
  console.error(`\nSHOPIFY_STORE is "${store}", but this repo is for ${EXPECTED_STORE}.`);
  console.error('Refusing to write to a different store.\n');
  process.exit(2);
}

let gql = null;
if (!DRY_RUN) {
  const [token] = require_(env, ['SHOPIFY_ADMIN_TOKEN']);
  gql = createClient({ store, token, version: apiVersion(env) });
}

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const PRODUCTS_BY_QUERY = `
  query($q: String!) {
    products(first: 100, query: $q) {
      nodes { id handle title tags }
    }
  }`;

const STAGED_UPLOADS = `
  mutation($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }`;

const PRODUCT_SET = `
  mutation($input: ProductSetInput!, $identifier: ProductSetIdentifiers) {
    productSet(input: $input, identifier: $identifier, synchronous: true) {
      product { id handle title }
      userErrors { field message }
    }
  }`;

const PUBLISH = `
  mutation($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }`;

const PRODUCT_DELETE = `
  mutation($input: ProductDeleteInput!) {
    productDelete(input: $input) {
      deletedProductId
      userErrors { field message }
    }
  }`;

// ---------------------------------------------------------------------------
// --undo
// ---------------------------------------------------------------------------

if (UNDO) {
  if (DRY_RUN) {
    console.error('\n--undo and --dry-run together do nothing useful. Pick one.\n');
    process.exit(2);
  }

  log(`\nUNDO → ${store}`);
  log(`Deleting products tagged "${spec.demo_tag}" whose title starts "${spec.title_prefix}".`);

  const found = (await gql(PRODUCTS_BY_QUERY, { q: `tag:'${spec.demo_tag}'` })).products.nodes;

  // Both guards must hold. A product that merely carries the demo tag — because
  // someone bulk-tagged a real piece in the admin — is not ours to delete.
  const ours = found.filter((p) => p.title.startsWith(spec.title_prefix));
  const spared = found.filter((p) => !p.title.startsWith(spec.title_prefix));

  if (!ours.length) {
    log('\nNothing to delete.\n');
    process.exit(0);
  }

  for (const product of ours) {
    await gql(PRODUCT_DELETE, { input: { id: product.id } });
    step(`deleted ${product.handle}`);
  }

  if (spared.length) {
    log(`\nLeft alone — tagged ${spec.demo_tag} but not prefixed "${spec.title_prefix}":`);
    for (const p of spared) log(`  ${p.handle}  "${p.title}"`);
  }

  log(`\nDeleted ${ours.length}.\n`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Assets must all be present before anything is sent
// ---------------------------------------------------------------------------

log(`\n${DRY_RUN ? 'PLAN (nothing will be sent)' : 'SEED'} → ${store}  api ${apiVersion(env)}`);
log(`Assets: ${ASSETS}`);

const missing = planned.flatMap((p) => p.images.filter((i) => !existsSync(i.path)));
const unsupported = planned.flatMap((p) =>
  p.images.filter((i) => existsSync(i.path) && !MIME[extname(i.file).toLowerCase()]),
);

if (missing.length || unsupported.length) {
  console.error('');
  for (const image of missing) console.error(`  MISSING      ${image.file}`);
  for (const image of unsupported) console.error(`  UNSUPPORTED  ${image.file} (${extname(image.file)})`);
  console.error(
    `\nThe asset folder is expected at:\n  ${ASSETS}\n\n` +
      'It sits beside the repo and is not checked in. Point elsewhere with:\n' +
      '  npm run demo:seed -- --assets "/path/to/Girlyf Assets"\n',
  );
  process.exit(2);
}

if (warnings.length) {
  log('\nWarnings from the fill-sheet validator:');
  for (const w of warnings) log(`  product ${w.line - 1}  ${w.column}: ${w.message}`);
}

// ---------------------------------------------------------------------------
// Plan / apply
// ---------------------------------------------------------------------------

log(`\nProducts (${planned.length})`);

if (DRY_RUN) {
  for (const { row, source, images } of planned) {
    const price = row['Variant Compare At Price']
      ? `${row['Variant Price']} was ${row['Variant Compare At Price']}`
      : row['Variant Price'];
    const materials = [source.material, source.material_2].filter(Boolean);
    step(`${row.Handle}`);
    step(`   title     ${row.Title}`);
    step(`   type      ${row.Type}`);
    step(`   tags      ${spec.demo_tag}`);
    step(`   sku       ${row['Variant SKU']}`);
    step(`   price     ${price}   stock ${row['Variant Inventory Qty']}`);
    step(`   ship      ${source.weight_grams}g  pack ${source.pack_size}`);
    step(`   metafield custom.category = ${source.category}`);
    step(`   metafield custom.material = ${JSON.stringify(materials)}`);
    if (source.pack_size) step(`   metafield custom.pack_size = ${source.pack_size}`);
    if (row['Metafield: custom.free_size [boolean]']) {
      step(`   metafield custom.free_size = ${row['Metafield: custom.free_size [boolean]']}`);
    }
    for (const image of images) step(`   image     ${image.file}`);
  }
  log(`\nWould create ${planned.length} products and upload ${planned.reduce((n, p) => n + p.images.length, 0)} images.`);
  log('Run `npm run demo:seed` to send it.\n');
  process.exit(0);
}

// --- what is already there --------------------------------------------------

const handles = planned.map((p) => p.row.Handle);
const existing = new Map(
  (await gql(PRODUCTS_BY_QUERY, { q: handles.map((h) => `handle:${h}`).join(' OR ') })).products.nodes
    .map((p) => [p.handle, p]),
);

// --- the one location, and the storefront channel ---------------------------

// Only `id` is read. Asking for `name` needs read_locations, which this token
// does not carry, and the name is not needed to set a quantity.
const locationId = (await gql(`{ locations(first: 1) { nodes { id } } }`)).locations.nodes[0]?.id;
if (!locationId) {
  console.error('\nThe store reports no locations, so stock cannot be set.\n');
  process.exit(2);
}

const onlineStore = (await gql(`{ publications(first: 25) { nodes { id name } } }`))
  .publications.nodes.find((p) => p.name === 'Online Store');
if (!onlineStore) {
  console.error('\nNo "Online Store" publication found — the products would be invisible.\n');
  process.exit(2);
}

// --- upload one image, via a staged target ----------------------------------

/**
 * Shopify will not fetch from a local disk, so the bytes go to a staged target
 * first and the product then references the `resourceUrl` it hands back.
 */
const upload = async (image) => {
  const bytes = readFileSync(image.path);
  const mimeType = MIME[extname(image.file).toLowerCase()];

  const [target] = (
    await gql(STAGED_UPLOADS, {
      input: [{
        resource: 'IMAGE',
        filename: image.file,
        mimeType,
        httpMethod: 'POST',
        fileSize: String(bytes.length),
      }],
    })
  ).stagedUploadsCreate.stagedTargets;

  const form = new FormData();
  // The order matters: every parameter Shopify returns must precede the file.
  for (const parameter of target.parameters) form.append(parameter.name, parameter.value);
  form.append('file', new Blob([bytes], { type: mimeType }), image.file);

  const response = await fetch(target.url, { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(
      `Upload of ${image.file} failed: ${response.status} ${response.statusText}\n` +
        (await response.text()).slice(0, 500),
    );
  }

  return target.resourceUrl;
};

// --- create --------------------------------------------------------------

const created = [];
const skipped = [];

for (const { row, source, images } of planned) {
  const handle = row.Handle;

  if (existing.has(handle) && !FORCE) {
    step(`exists ${handle} — left alone. Use --force to overwrite, or --undo first.`);
    skipped.push(handle);
    continue;
  }

  const sources = [];
  for (const image of images) {
    sources.push({ originalSource: await upload(image), alt: image.alt, contentType: 'IMAGE' });
    step(`uploaded ${image.file}`);
  }

  const freeSize = row['Metafield: custom.free_size [boolean]'];
  const materials = [source.material, source.material_2].filter(Boolean);

  // Category and material are METAFIELDS, not tags. The category collections
  // key off custom.category, so the metafield is the single fact that decides
  // where a product appears — see decisions/category-is-a-locked-choice-metafield.
  //
  // No `category:` or `material:` tag is emitted. Two places holding the same
  // fact is how they come to disagree, and only one of them drives anything.
  const metafields = [
    { namespace: 'custom', key: 'category', type: 'single_line_text_field', value: source.category },
    {
      namespace: 'custom',
      key: 'material',
      type: 'list.single_line_text_field',
      value: JSON.stringify(materials),
    },
    ...(source.pack_size
      ? [{ namespace: 'custom', key: 'pack_size', type: 'single_line_text_field', value: source.pack_size }]
      : []),
    ...(freeSize
      ? [{ namespace: 'custom', key: 'free_size', type: 'boolean', value: freeSize }]
      : []),
  ];

  const input = {
    handle,
    title: row.Title,
    descriptionHtml: row['Body (HTML)'],
    vendor: row.Vendor,
    productType: row.Type,
    // Only the demo tag. `edit:*` is the namespace set aside for ad-hoc
    // groupings, and it is what makes --undo able to find these again.
    tags: [spec.demo_tag],
    status: 'ACTIVE',
    files: sources,
    metafields,
    productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
    variants: [{
      optionValues: [{ optionName: 'Title', name: 'Default Title' }],
      sku: row['Variant SKU'],
      price: row['Variant Price'],
      ...(row['Variant Compare At Price']
        ? { compareAtPrice: row['Variant Compare At Price'] }
        : {}),
      taxable: true,
      inventoryPolicy: 'DENY',
      inventoryItem: {
        tracked: true,
        requiresShipping: true,
        // Weight is Shopify's own field, in grams. Pack size is the metafield
        // beside it — together they are what a courier rate is computed from.
        ...(source.weight_grams
          ? { measurement: { weight: { value: Number(source.weight_grams), unit: 'GRAMS' } } }
          : {}),
      },
      inventoryQuantities: [{
        locationId,
        name: 'available',
        quantity: Number(row['Variant Inventory Qty']),
      }],
    }],
  };

  const { product } = (await gql(PRODUCT_SET, { input, identifier: { handle } })).productSet;

  // Created products are not on the storefront until published, and an
  // unpublished demo is a demo of a 404.
  await gql(PUBLISH, { id: product.id, input: [{ publicationId: onlineStore.id }] });

  step(`created ${handle.padEnd(30)} ${images.length} image${images.length === 1 ? '' : 's'}`);
  created.push(handle);
}

// ---------------------------------------------------------------------------

log(`\nCreated: ${created.length}   Unchanged: ${skipped.length}`);
log(`\nAll five carry the "${spec.demo_tag}" tag. To remove them again:`);
log('  npm run demo:seed -- --undo');
log('');
log('Category collections stay UNPUBLISHED until they pass the 3-product gate, so');
log('the demo products are reachable by search and direct link, and via any');
log('collection that already qualifies — not yet from the category menu.');
log('');
