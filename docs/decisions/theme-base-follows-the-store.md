# The theme base is whatever the dev store ships with, not Dawn

**Status:** Accepted · 2026-08-17 — the *deferral* is decided. The base itself is
open until the store exists.

## Context

The build checklist specifies Dawn, on the reasoning that Dawn is Shopify's
reference theme and is fully section/block-based.

[`homingo-shopify-theme`](https://github.com/Crownshire/homingo-shopify-theme),
built two days earlier by the same author, made exactly this assumption and paid
for it. Its README:

> The store shipped with Horizon, so Horizon is what Homingo runs. Dawn was the
> original base before that was known. **Do not publish Dawn** — it would
> replace the live theme with a different architecture.

That repo now carries a dead `themes/dawn` reference copy, a doubled
`theme check` surface, and a standing warning not to deploy half of itself.

New Shopify stores in 2026 ship Horizon. So "we will use Dawn" is not a default
being accepted — it is a decision to *overwrite* what the store provides, and it
was being made before anyone had looked at the store.

## Decision

**Create the dev store first. Build on the theme it ships with.** Do not choose a
base from the plan.

**Keep exactly one theme in the repo.** Whichever base is adopted, the other is
not retained "for reference".

## Consequences

- If the store ships Horizon, that is a better fit than Dawn for this brand
  anyway. Horizon derives its whole look from four palette slots — one place a
  colour is born — which is what makes a token discipline enforceable. Dawn has
  five fixed colour schemes and a colour can be born in any of them.
- Girlyf's palette has **six** named roles against Horizon's four slots, so
  either base needs a documented mapping. That mapping is a follow-up decision,
  and it is where Gold and Paper will have to fight for a slot.
- Section/block authoring differs between the two. Any homepage section work
  starts only after the base is known, or it gets written twice.

## Rejected

**Dawn, deliberately.** More community precedent and app examples, and a Dawn
reference build already exists next door. Rejected because publishing Dawn over
the shipped theme is the exact move Homingo's README warns against, and nothing
in the Girlyf plan needs a Dawn-specific capability.

**Tracking both, like Homingo.** That is the state Homingo ended up in, not the
state it chose. Copying an outcome someone regretted is not a decision.
