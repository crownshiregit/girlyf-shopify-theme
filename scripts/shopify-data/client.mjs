// Shared environment loading and Admin GraphQL client for scripts/shopify-data.
// Zero dependencies on purpose: a store-setup step that needs `npm install` to
// run is a step that rots between the build and the handover.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** The store this repo is for. A token for any other store is a mistake. */
export const EXPECTED_STORE = 'ffaznr-4y.myshopify.com';

/**
 * The scopes the app must have been RELEASED with. Kept here as well as in
 * .env.example because authorize.mjs sends them in the OAuth request, and a
 * mismatch with the released configuration is the failure that looks like a
 * typo in the redirect URL.
 */
export const SCOPES = [
  'read_products',
  'write_products',
  'write_publications',
  'read_inventory',
  'write_inventory',
  'write_files',
];

export const REDIRECT_PORT = 3456;
export const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

/** Parse .env without a dependency. Ignores comments and blank lines. */
export const loadEnv = () => {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) {
    throw new Error('No .env found. Copy .env.example to .env and fill it in — see its comments.');
  }
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const at = trimmed.indexOf('=');
    if (at === -1) continue;
    env[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim();
  }
  return env;
};

/** Fail with a useful message rather than a 401 from Shopify. */
export const require_ = (env, keys) => {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `.env is missing: ${missing.join(', ')}\n` +
        'See the comments in .env.example — every value has a stated source.',
    );
  }
  return keys.map((k) => env[k]);
};

export const apiVersion = (env) => env.SHOPIFY_API_VERSION || '2026-07';

export const normaliseStore = (store) =>
  store.replace(/^https?:\/\//, '').replace(/\/$/, '');

/**
 * A GraphQL caller against the Admin API. Throws on transport errors, on
 * GraphQL `errors`, and on `userErrors` — the last of which Shopify returns
 * with a 200, and which is the one people forget to check.
 */
export const createClient = ({ store, token, version }) => {
  const endpoint = `https://${normaliseStore(store)}/admin/api/${version}/graphql.json`;

  return async (query, variables = {}) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 404) {
        throw new Error(
          `404 from ${endpoint}\nAPI version "${version}" may not exist. ` +
            'Check the version dropdown in the store admin.',
        );
      }
      throw new Error(`${response.status} ${response.statusText}\n${body.slice(0, 800)}`);
    }

    const payload = await response.json();

    if (payload.errors) {
      const messages = payload.errors.map((e) => e.message).join('; ');
      if (/access denied|not approved/i.test(messages)) {
        throw new Error(
          `${messages}\n\nThe token lacks a scope. A token keeps the scopes it was ` +
            'granted with — release a new app version AND re-run npm run data:authorize.',
        );
      }
      throw new Error(messages);
    }

    // userErrors come back with HTTP 200 and a successful GraphQL response.
    const userErrors = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      for (const [key, value] of Object.entries(node)) {
        if (key === 'userErrors' && Array.isArray(value)) userErrors.push(...value);
        else walk(value);
      }
    };
    walk(payload.data);
    if (userErrors.length) {
      throw new Error(
        'userErrors:\n' +
          userErrors.map((e) => `  ${(e.field || []).join('.')}: ${e.message}`).join('\n'),
      );
    }

    return payload.data;
  };
};
