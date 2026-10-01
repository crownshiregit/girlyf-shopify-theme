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

// Re-pointing a live collection's rule is a MIGRATION, not an edit — every
// product's membership is recomputed by Shopify the moment it lands. So it is
// opt-in and loud, rather than something a changed JSON file does quietly.
const MIGRATE_RULES = args.has('--migrate-rules');

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
      nodes {
        id namespace key type { name } pinnedPosition
        capabilities { smartCollectionCondition { eligible enabled } }
      }
    }
  }`;

const DEFINITION_CREATE = `
  mutation($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id namespace key }
      userErrors { field message code }
    }
  }`;

/** `namespace.key` → definition id, for collection rules that key off one. */
const definitionIds = new Map();

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

  const wantsRuleCapability = definition.capabilities?.smartCollectionCondition?.enabled === true;

  if (existing) {
    definitionIds.set(`${definition.namespace}.${definition.key}`, existing.id);
    const condition = existing.capabilities?.smartCollectionCondition;

    if (existing.type?.name !== definition.type) {
      step(`DRIFT  ${label}: store has ${existing.type?.name}, this file says ${definition.type}`);
      drifted.push(`${label} — type differs, not migrated`);
    } else if (existing.pinnedPosition === null) {
      step(`exists ${label} — but NOT PINNED. Pin it in the admin, or it stays invisible.`);
      drifted.push(`${label} — unpinned`);
    } else if (wantsRuleCapability && !condition?.enabled) {
      // Without this, a collection rule on the field cannot be created at all —
      // and the enum accepts PRODUCT_METAFIELD_DEFINITION regardless, so the
      // failure arrives later and reads like a bad rule rather than a missing
      // opt-in.
      step(
        `DRIFT  ${label}: collection-condition capability is OFF` +
          (condition?.eligible === false ? ' and this type is NOT ELIGIBLE for it.' : '.'),
      );
      drifted.push(`${label} — smartCollectionCondition disabled, categories cannot key off it`);
    } else {
      step(`exists ${label}`);
      skipped.push(label);
    }
    continue;
  }

  const { metafieldDefinitionCreate } = await gql(DEFINITION_CREATE, { definition });
  definitionIds.set(
    `${definition.namespace}.${definition.key}`,
    metafieldDefinitionCreate.createdDefinition.id,
  );
  step(
    `created ${label} (${definition.type}, pinned` +
      (wantsRuleCapability ? ', collection-condition on' : '') +
      ')',
  );
  created.push(label);
}

// --- 2. collections ---------------------------------------------------------

// `collectionByHandle` was removed from the Admin API — it does not exist in
// 2026-07. A handle lookup is a filtered query now.
const COLLECTION_BY_HANDLE = `
  query($q: String!) {
    collections(first: 1, query: $q) {
      nodes {
        id title sortOrder
        ruleSet {
          rules {
            column relation condition
            conditionObject {
              ... on CollectionRuleMetafieldCondition { metafieldDefinition { id namespace key } }
            }
          }
        }
      }
    }
  }`;

const COLLECTION_CREATE = `
  mutation($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection { id handle title }
      userErrors { field message }
    }
  }`;

const COLLECTION_UPDATE = `
  mutation($input: CollectionInput!) {
    collectionUpdate(input: $input) {
      collection { id handle }
      userErrors { field message }
    }
  }`;

/**
 * A rule in collections.json names its metafield as `custom.category`; the API
 * wants the definition's id in `conditionObjectId`. Resolve late, so the file
 * stays readable and stays valid across stores — ids differ per store.
 */
const toRuleInput = (rule, handle) => {
  const { metafield, ...rest } = rule;
  if (!metafield) return rest;

  const id = definitionIds.get(metafield);
  if (!id) {
    throw new Error(
      `Collection "${handle}" keys off metafield ${metafield}, which has no definition.\n` +
        'Definitions are created earlier in this same run, so this means it is absent from\n' +
        'definitions/metafields.json — or its type is not eligible to be a collection condition.',
    );
  }
  return { ...rest, conditionObjectId: id };
};

/** What the store currently has, in the same shape, so the two can be compared. */
const storeRuleOf = (found) => {
  const rule = found.ruleSet?.rules?.[0];
  if (!rule) return null;
  return {
    column: rule.column,
    relation: rule.relation,
    condition: rule.condition,
    conditionObjectId: rule.conditionObject?.metafieldDefinition?.id,
  };
};

const describe = (rule) =>
  `${rule.column}${rule.metafield ? ` ${rule.metafield}` : ''} ${rule.relation} "${rule.condition}"`;

const all = [
  ...collections.categories.map((c) => ({ ...c, kind: 'category' })),
  ...collections.merchandising.map((c) => ({ ...c, kind: 'merchandising' })),
];

log(`\nCollections (${collections.categories.length} categories + ${collections.merchandising.length} merchandising)`);

for (const collection of all) {
  const { handle, title, descriptionHtml, rule, sortOrder } = collection;
  const label = `${handle}`;

  if (DRY_RUN) {
    step(`would create ${label.padEnd(22)} ${describe(rule)}`);
    created.push(label);
    continue;
  }

  const ruleInput = toRuleInput(rule, handle);
  const input = {
    handle,
    title,
    descriptionHtml,
    ruleSet: { appliedDisjunctively: false, rules: [ruleInput] },
    ...(sortOrder ? { sortOrder } : {}),
  };

  const found = (await gql(COLLECTION_BY_HANDLE, { q: `handle:${handle}` })).collections.nodes[0];

  if (found) {
    const storeRule = storeRuleOf(found);
    const same =
      storeRule &&
      storeRule.column === ruleInput.column &&
      storeRule.relation === ruleInput.relation &&
      storeRule.condition === ruleInput.condition &&
      storeRule.conditionObjectId === ruleInput.conditionObjectId;

    if (same) {
      step(`exists ${label}`);
      skipped.push(label);
      continue;
    }

    const was = storeRule
      ? `${storeRule.column} ${storeRule.relation} "${storeRule.condition}"`
      : '(none — hand-curated?)';

    if (!MIGRATE_RULES) {
      step(`DRIFT  ${label}: store rule is ${was}`);
      drifted.push(`${label} — rule differs, not migrated`);
      continue;
    }

    // Explicitly asked for. Shopify recomputes membership on save, so this is
    // the moment every product in the collection is re-evaluated.
    await gql(COLLECTION_UPDATE, { input: { id: found.id, ruleSet: input.ruleSet } });
    step(`MIGRATED ${label.padEnd(21)} ${was}  →  ${describe(rule)}`);
    created.push(`${label} (rule migrated)`);
    continue;
  }

  await gql(COLLECTION_CREATE, { input });
  step(`created ${label.padEnd(22)} ${describe(rule)}`);
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
