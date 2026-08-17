# Placeholder imagery cannot reach a published product

**Status:** Accepted · 2026-08-17

## Context

Only three of the ten categories have product photography today — Necklaces,
Earrings, Bracelets & Bangles. The other seven ship with photographer briefs
instead of images.

The reference build deliberately makes this worse before it makes it better: one
reference product is a **ring**, built with placeholder imagery, so that the
multi-row variant format has a worked example the team can copy. Rings have no
photography.

So the repo will contain a product that looks finished, is meant to be copied, and
must never be visible to a customer. That is precisely the artefact that leaks.

## Decision

**A check fails if placeholder media is reachable on a published product.**
Enforcement is a script, not a note in a README and not anyone's memory.

Placeholder files are named so they are machine-detectable, and the reference ring
stays unpublished until real photography replaces them.

## Consequences

- The seven photography-less categories are already gated by the publication rule
  in [categories-created-before-they-are-published](categories-created-before-they-are-published.md)
  — products *and* a hero image. This check is the same discipline one level down,
  at the product rather than the collection.
- The check is the thing that makes it safe to build a reference product from fake
  photos at all. Without it, the honest alternative would be no ring example, and
  the first person to add a sized ring would be attempting variant rows unaided.
- Shoot briefs for all seven missing categories already exist in the brand
  guidelines, written to match the existing shoot's light and props. They are the
  queue this check is protecting.

## Rejected

**A note in the README.** The failure mode is somebody publishing in a hurry
months from now, and a note does not run.
