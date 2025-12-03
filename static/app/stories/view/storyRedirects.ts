/**
 * Maps old category-based URLs to new hierarchy URLs.
 *
 * Component URLs (/stories/core/*) stay the same - subcategory is navigation-only.
 * This map handles redirects for renamed sections.
 */
export const STORY_REDIRECTS: Record<string, string> = {
  // Old foundations -> principles
  '/stories/foundations/colors': '/stories/principles/colors',
  '/stories/foundations/icons': '/stories/principles/icons',
  '/stories/foundations/images': '/stories/principles/images',
  '/stories/foundations/typography': '/stories/principles/typography',

  // Old top-level typography -> core (now grouped under Components > Typography in nav)
  '/stories/typography/heading': '/stories/core/heading',
  '/stories/typography/prose': '/stories/core/prose',
  '/stories/typography/text': '/stories/core/text',
  '/stories/typography/inline-code': '/stories/core/inline-code',
  '/stories/typography/quote': '/stories/core/quote',

  // Old top-level layout -> core (now grouped under Components > Layout in nav)
  '/stories/layout/flex': '/stories/core/flex',
  '/stories/layout/grid': '/stories/core/grid',
  '/stories/layout/stack': '/stories/core/stack',
  '/stories/layout/container': '/stories/core/container',
  '/stories/layout/composition': '/stories/core/composition',
};
