#!/usr/bin/env node
// Applies scripts/shopify-data to the store. Idempotent — a second run is a
// no-op, not a duplicate.
//
//   npm run data:plan    # --dry-run: prints what it would send, needs no token
//   npm run data:apply   # sends it
//
// Order is fixed and matters:
//   1. metafield definitions  — pinned, so they are visible in the admin form
//   2. collections            — rule-based, so products file themselves later
//
// ADDITIVE ONLY. Anything present in the store but absent here is left alone,
// and anything whose shape has drifted is REPORTED rather than migrated.
// Destroying store data because a JSON file changed is not worth automating.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadEnv, require_, createClient, apiVersion,
  normaliseStore, EXPECTED_STORE, ROOT,
} from './client.mjs';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');

const read = (relative) => {
  const raw = JSON.parse(readFileSync(join(ROOT, 'scripts/shopify-data', relative), 'utf8'));
  // `_`-prefixed keys are documentation for humans and never sent.
  const strip = (node) => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === 'object') {
      return Object.fromEntries(
        Object.entries(node).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, strip(v)]),
      );
    }
    return node;
  };
  return strip(raw);
};

const metafields = read('definitions/metafields.json');
const collections = read('content/collections.json');

let gql = null;
const created = [];
const skipped = [];
const drifted = [];

const log = (m) => console.log(m);
const step = (m) => console.log(`  ${m}`);

// ---------------------------------------------------------------------------

const env = loadEnv();
const store = normaliseStore(env.SHOPIFY_STORE || '');

if (store !== EXPECTED_STORE) {
  console.error(`\nSHOPIFY_STORE is "${store}", but this repo is for ${EXPECTED_STORE}.`);
  console.error('Refusing to write to a different store.\n');
  process.exit(2);
}

if (!DRY_RUN) {
  const [token] = require_(env, ['SHOPIFY_ADMIN_TOKEN']);
  gql = createClient({ store, token, version: apiVersion(env) });
}

log(`\n${DRY_RUN ? 'PLAN (nothing will be sent)' : 'APPLY'} → ${store}  api ${apiVersion(env)}`);

// --- 1. metafield definitions ----------------------------------------------

const DEFINITION_QUERY = `
  query($ownerType: MetafieldOwnerType!) {
    metafieldDefinitions(first: 250, ownerType: $ownerType) {
      nodes { id namespace key type { name } pinnedPosition }
    }
  }`;

const DEFINITION_CREATE = `
  mutation($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id namespace key }
      userErrors { field message code }
    }
  }`;

log('\nMetafield definitions');

const existingByOwner = new Map();
if (!DRY_RUN) {
  for (const ownerType of new Set(metafields.definitions.map((d) => d.ownerType))) {
    const data = await gql(DEFINITION_QUERY, { ownerType });
    existingByOwner.set(ownerType, data.metafieldDefinitions.nodes);
  }
}

for (const definition of metafields.definitions) {
  const label = `${definition.ownerType.toLowerCase()} ${definition.namespace}.${definition.key}`;

  if (DRY_RUN) {
    step(`would create ${label} (${definition.type}, pinned)`);
    created.push(label);
    continue;
  }

  const existing = (existingByOwner.get(definition.ownerType) || []).find(
    (d) => d.namespace === definition.namespace && d.key === definition.key,
  );

  if (existing) {
    if (existing.type?.name !== definition.type) {
      step(`DRIFT  ${label}: store has ${existing.type?.name}, this file says ${definition.type}`);
      drifted.push(`${label} — type differs, not migrated`);
    } else if (existing.pinnedPosition === null) {
      step(`exists ${label} — but NOT PINNED. Pin it in the admin, or it stays invisible.`);
      drifted.push(`${label} — unpinned`);
    } else {
      step(`exists ${label}`);
      skipped.push(label);
    }
    continue;
  }

  await gql(DEFINITION_CREATE, { definition });
  step(`created ${label} (${definition.type}, pinned)`);
  created.push(label);
}

// --- 2. collections ---------------------------------------------------------

const COLLECTION_BY_HANDLE = `
  query($handle: String!) {
    collectionByHandle(handle: $handle) {
      id title sortOrder
      ruleSet { rules { column relation condition } }
    }
  }`;

const COLLECTION_CREATE = `
  mutation($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection { id handle title }
      userErrors { field message }
    }
  }`;

const all = [
  ...collections.categories.map((c) => ({ ...c, kind: 'category' })),
  ...collections.merchandising.map((c) => ({ ...c, kind: 'merchandising' })),
];

log(`\nCollections (${collections.categories.length} categories + ${collections.merchandising.length} merchandising)`);

for (const collection of all) {
  const { handle, title, descriptionHtml, rule, sortOrder } = collection;
  const label = `${handle}`;

  const input = {
    handle,
    title,
    descriptionHtml,
    ruleSet: { appliedDisjunctively: false, rules: [rule] },
    ...(sortOrder ? { sortOrder } : {}),
  };

  if (DRY_RUN) {
    step(`would create ${label.padEnd(22)} ${rule.column} ${rule.relation} "${rule.condition}"`);
    created.push(label);
    continue;
  }

  const found = (await gql(COLLECTION_BY_HANDLE, { handle })).collectionByHandle;

  if (found) {
    const storeRule = found.ruleSet?.rules?.[0];
    const same =
      storeRule &&
      storeRule.column === rule.column &&
      storeRule.relation === rule.relation &&
      storeRule.condition === rule.condition;
    if (!same) {
      step(`DRIFT  ${label}: store rule is ${storeRule ? `${storeRule.column} ${storeRule.relation} "${storeRule.condition}"` : '(none — hand-curated?)'}`);
      drifted.push(`${label} — rule differs, not migrated`);
    } else {
      step(`exists ${label}`);
      skipped.push(label);
    }
    continue;
  }

  await gql(COLLECTION_CREATE, { input });
  step(`created ${label.padEnd(22)} ${rule.column} ${rule.relation} "${rule.condition}"`);
  created.push(label);
}

// --- summary ----------------------------------------------------------------

log(`\n${DRY_RUN ? 'Would create' : 'Created'}: ${created.length}   Unchanged: ${skipped.length}   Drifted: ${drifted.length}`);

if (drifted.length) {
  log('\nDrift — reported, never migrated:');
  for (const d of drifted) log(`  ${d}`);
  log('\nResolve these by hand, deliberately. Nothing was overwritten.');
}

if (!DRY_RUN) {
  const gate = collections.publication_policy;
  log(`\nEvery collection is created UNPUBLISHED. A category joins the menu at`);
  log(`${gate.min_products}+ products and a hero image — publish it in the admin when it qualifies.`);
}

log('');
process.exit(drifted.length ? 1 : 0);
