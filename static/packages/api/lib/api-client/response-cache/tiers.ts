/**
 * Fallback TTL tiers for Sentry API GET responses that carry no HTTP caching
 * headers. Responses with `Cache-Control`, `Expires`, or validators follow
 * those headers instead; the host's cache decides which applies.
 */

/**
 * TTL tier for a URL.
 *
 * - `stable`: data that changes infrequently (orgs, projects, teams,
 *   organization event details, trace-item details)
 * - `volatile`: data that changes often (issues and their events, project
 *   event details, full traces, log and span queries)
 * - `no-cache`: never cache (polling endpoints like autofix state)
 *
 * No tier treats a response as immutable. Event payloads embed mutable
 * fields (`nextEventID`, user reports, release data), `latest`/`oldest`/
 * `recommended` resolve to different events over time, and traces gain
 * spans as they arrive (getsentry/sentry#128818).
 */
export type TtlTier = "stable" | "volatile" | "no-cache";

/** Fallback TTL durations by tier (milliseconds). `no-cache` uses 0 as a sentinel. */
export const FALLBACK_TTL_MS: Readonly<Record<TtlTier, number>> = {
  stable: 5 * 60 * 1000,
  volatile: 60 * 1000,
  "no-cache": 0,
};

/**
 * URL patterns grouped by TTL tier, checked in priority order
 * (no-cache → volatile). `stable` is the default when nothing matches.
 *
 * TODO: Classify by generated operation metadata from `@sentry/api` instead
 * of URL regexes, once it ships per-operation metadata
 * (getsentry/sentry-api-schema#81) and a route-keyed operation map
 * (getsentry/sentry-api-schema#102).
 */
const URL_TIER_PATTERNS: readonly [TtlTier, readonly RegExp[]][] = [
  // Polling endpoints where state changes rapidly
  ["no-cache", [/\/(?:autofix|root-cause)\//]],
  [
    "volatile",
    [
      // Issue endpoints: lists, detail views, and issue events such as
      // `/issues/{id}/events/latest/`
      /\/issues\//,
      /[?&]dataset=(?:logs|spans)/,
      /\/trace-logs\//,
      // Full traces gain spans as they arrive
      /\/trace\/[0-9a-f]{32}\//,
      // Project event details embed user reports (and `nextEventID`/
      // `previousEventID` unless collapsed), and reprocessing can change them
      // for the same ID
      /\/projects\/[^/]+\/[^/]+\/events\/[^/?]+\/?(?:\?|$)/,
    ],
  ],
];

/**
 * Classify a URL into a TTL tier for fallback caching.
 *
 * @param url - Full URL string (with query params)
 */
export function classifyUrl(url: string): TtlTier {
  for (const [tier, patterns] of URL_TIER_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(url))) {
      return tier;
    }
  }
  return "stable";
}
