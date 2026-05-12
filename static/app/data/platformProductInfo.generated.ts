// DO NOT EDIT — regenerate via `pnpm gen:platform-info`.
//
// Generated from sentry-docs frontmatter (`docs/platforms/<lang>/[common/]<feature>/index.mdx`).
// Drives the informational card variant on the SCM onboarding step for
// platforms whose onboarding is wizard-driven (i.e. the install step calls
// out to the `@sentry/wizard` CLI), since toggles aren't actionable in that
// flow but communicating which products apply still is.
//
// Scope filters applied during generation:
//   1. Platforms curated in `platformProductAvailability` are excluded — the
//      curated map is the source of truth for their toggles, and the consumer
//      (`scmPlatformFeatures.tsx`) routes between the two via
//      `platform in platformProductAvailability`.
//   2. Platforms whose `gettingStartedDocs/<id>/` files don't reference the
//      wizard CLI are excluded — without a wizard AND without curated
//      toggles, the consumer renders nothing on the SCM step.
//
// To extend scope, drop the corresponding filter in
// `scripts/genPlatformProductInfo.ts`.

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {PlatformKey} from 'sentry/types/project';

export const PLATFORM_PRODUCT_INFO: Partial<
  Record<PlatformKey, readonly ProductSolution[]>
> = {
  android: [
    ProductSolution.LOGS,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.METRICS,
  ],
  'apple-ios': [
    ProductSolution.LOGS,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.METRICS,
  ],
  flutter: [
    ProductSolution.LOGS,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.METRICS,
  ],
  'javascript-nextjs': [
    ProductSolution.LOGS,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.METRICS,
  ],
  'javascript-nuxt': [
    ProductSolution.LOGS,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.METRICS,
  ],
  'javascript-react-router': [
    ProductSolution.LOGS,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.METRICS,
  ],
  'javascript-remix': [
    ProductSolution.LOGS,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.METRICS,
  ],
  'javascript-sveltekit': [
    ProductSolution.LOGS,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.METRICS,
  ],
  'react-native': [
    ProductSolution.LOGS,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.METRICS,
  ],
};
