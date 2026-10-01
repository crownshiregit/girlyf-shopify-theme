/**
 * GIRLYF MOTION — the enhancements.
 *
 * Everything here is optional. The reveal engine is inline in
 * `snippets/girlyf-motion.liquid` because it owns visibility; this file owns
 * only things a page is complete without — a photograph that drifts, a clip
 * that starts itself, a rail that reports where it is. If this module never
 * loads, the homepage is a correctly-framed static page, not a broken one.
 *
 * Three behaviours, all attribute-driven, none of them a custom element:
 *
 *   [data-girlyf-parallax]   media that drifts against the scroll
 *   [data-girlyf-autoplay]   a muted clip that plays only while on screen
 *   [data-girlyf-rail]       a scroll rail that publishes its own progress
 *
 * Attributes rather than custom elements because all three attach to *existing*
 * markup — a <video> Shopify's `video_tag` produced, an <img> from `image_tag`.
 * Wrapping vendor output in a custom element to attach a scroll listener buys a
 * lifecycle nothing here needs.
 */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Data saver is a request not to stream video the visitor did not ask for. */
const FRUGAL = Boolean(navigator.connection?.saveData);

/* -------------------------------------------------------------------------
 * Parallax
 * ------------------------------------------------------------------------- */

/** @type {Set<HTMLElement>} Elements currently on screen. Only these are measured. */
const drifting = new Set();

let frameQueued = false;

/**
 * Reads how far an element's frame has travelled through the viewport, as -1
 * (frame entering from below) through 0 (centred) to 1 (leaving past the top).
 *
 * Measured on the FRAME — the element's offset parent, which is the fixed
 * window the media is over-scaled inside — not on the media, whose own box is
 * already being transformed by the last frame's result.
 *
 * @param {HTMLElement} frame
 * @returns {number}
 */
function progressThroughViewport(frame) {
  const box = frame.getBoundingClientRect();
  const viewport = window.innerHeight || document.documentElement.clientHeight;
  const travel = (viewport + box.height) / 2;
  if (travel === 0) return 0;

  const offsetFromCentre = viewport / 2 - (box.top + box.height / 2);
  return Math.max(-1, Math.min(1, offsetFromCentre / travel));
}

function paintParallax() {
  frameQueued = false;

  for (const media of drifting) {
    const frame = media.parentElement;
    if (!frame) continue;

    const distance = Number(media.dataset.girlyfParallax) || 40;
    const shift = progressThroughViewport(frame) * distance;

    media.style.setProperty('--girlyf-parallax', `${shift.toFixed(2)}px`);
  }
}

function requestParallaxFrame() {
  if (frameQueued || drifting.size === 0) return;
  frameQueued = true;
  requestAnimationFrame(paintParallax);
}

/**
 * The scale the media needs so that drifting by ±distance never exposes an edge
 * of its frame. Set from measurement rather than guessed in CSS, because a
 * 40px drift inside a 200px tile and inside a 900px hero need very different
 * numbers, and the CSS default has to cover the worst case for both.
 *
 * @param {HTMLElement} media
 */
function fitParallaxScale(media) {
  const frame = media.parentElement;
  if (!frame) return;

  const height = frame.getBoundingClientRect().height;
  if (height === 0) return;

  const distance = Number(media.dataset.girlyfParallax) || 40;
  const scale = 1 + (distance * 2) / height;

  media.style.setProperty('--girlyf-parallax-scale', scale.toFixed(4));
}

const parallaxWatcher = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const media = /** @type {HTMLElement} */ (entry.target);

      if (entry.isIntersecting) {
        fitParallaxScale(media);
        drifting.add(media);
      } else {
        drifting.delete(media);
      }
    }
    requestParallaxFrame();
  },
  { rootMargin: '15% 0px' }
);

/* -------------------------------------------------------------------------
 * Clips that play only while they are being looked at
 *
 * Every Girlyf clip is muted, short and looping — a reel or a category tile —
 * so `play()` needs no gesture. Playing all of them at once is what makes a
 * page of nine autoplaying videos stutter, so the observer is the throttle.
 * ------------------------------------------------------------------------- */

const clipWatcher = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const clip = /** @type {HTMLVideoElement} */ (entry.target);

      if (entry.isIntersecting) {
        /* A rejected play() is not an error worth surfacing: the browser
           declined, the poster frame stays, and the page is unharmed. */
        clip.play().catch(() => {});
      } else {
        clip.pause();
      }
    }
  },
  /* Half visible: on a rail, a card peeking in from the edge should not start
     playing until it is genuinely the thing being looked at. */
  { threshold: 0.5 }
);

/**
 * @param {HTMLVideoElement} clip
 */
function armClip(clip) {
  clip.muted = true;
  clip.loop = true;
  clip.playsInline = true;
  /* `preload="none"` in the markup keeps the request off the critical path;
     metadata is enough to paint the first frame once we are near. */
  if (clip.preload === 'none') clip.preload = 'metadata';

  clipWatcher.observe(clip);
}

/* -------------------------------------------------------------------------
 * Rails
 *
 * A rail publishes `--girlyf-rail-progress` (0–1) so a section can draw its own
 * indicator in CSS. Nothing here draws one — a scroll position is a fact, and
 * what it looks like is the section's business.
 * ------------------------------------------------------------------------- */

/**
 * @param {HTMLElement} rail
 */
function trackRail(rail) {
  const publish = () => {
    const travel = rail.scrollWidth - rail.clientWidth;
    const progress = travel > 0 ? rail.scrollLeft / travel : 0;

    rail.style.setProperty('--girlyf-rail-progress', progress.toFixed(4));
    /* Lets a section grey out an arrow, or hide the whole control when there is
       nothing to scroll — which is the common case on a wide desktop. */
    rail.toggleAttribute('data-girlyf-rail-scrollable', travel > 1);
  };

  rail.addEventListener('scroll', publish, { passive: true });
  new ResizeObserver(publish).observe(rail);
  publish();
}

/* -------------------------------------------------------------------------
 * Wiring
 * ------------------------------------------------------------------------- */

/**
 * @param {ParentNode} within
 */
function enhance(within) {
  if (!REDUCED.matches) {
    for (const media of within.querySelectorAll('[data-girlyf-parallax]')) {
      parallaxWatcher.observe(media);
    }

    if (!FRUGAL) {
      for (const clip of within.querySelectorAll('video[data-girlyf-autoplay]')) {
        armClip(/** @type {HTMLVideoElement} */ (clip));
      }
    }
  }

  for (const rail of within.querySelectorAll('[data-girlyf-rail]')) {
    trackRail(/** @type {HTMLElement} */ (rail));
  }
}

window.addEventListener('scroll', requestParallaxFrame, { passive: true });
window.addEventListener('resize', () => {
  for (const media of drifting) fitParallaxScale(media);
  requestParallaxFrame();
});

/* Turning motion down mid-session must stop the drift where it is, not leave
   the media parked at whatever offset the last frame wrote. */
REDUCED.addEventListener('change', (event) => {
  if (!event.matches) return;

  for (const media of drifting) media.style.setProperty('--girlyf-parallax', '0px');
  drifting.clear();
});

enhance(document);

/* The theme editor swaps a section's DOM wholesale; its media is new. */
document.addEventListener('shopify:section:load', (event) => {
  enhance(/** @type {HTMLElement} */ (event.target));
});
