/**
 * Compute cache-invalidation prefixes for a mutation URL.
 *
 * The host's HTTP layer calls {@link computeInvalidationPrefixes} after
 * every successful non-GET request and deletes the requesting identity's
 * cached entries whose URL starts with any returned prefix. Two rules
 * apply:
 *
 * 1. **Hierarchy walk.** Sweep the URL's own path and every ancestor
 *    up to `/api/0/`. A mutation on
 *    `/organizations/{org}/releases/1.0.0/deploys/` sweeps itself,
 *    `.../releases/1.0.0/`, and `.../releases/` — which catches the
 *    detail, deploys-list, and releases-list GET caches in one pass.
 *
 * 2. **Cross-endpoint rules.** A small hardcoded table for mutations
 *    whose effects cross URL trees. For example, creating a project
 *    under a team hits `/organizations/{org}/teams/{team}/projects/`
 *    but invalidates the org project list at
 *    `/organizations/{org}/projects/`. The table is tiny today
 *    (2 rules) and only grows when a new cross-tree relationship
 *    appears in the API surface.
 *
 * Prefixes are identity-scoped at the sweep layer (the store checks each
 * entry's identity before deleting it), so a slightly broader sweep is safe — it can only touch the current
 * identity's entries. Query strings on the mutation URL are dropped
 * from the prefix (a prefix sweep on the path naturally catches every
 * query-param variant cached under that path).
 */

const API_V0_SEGMENT = "/api/0/";
const TRAILING_SLASH_RE = /\/$/;

/**
 * Paths where a mutation doesn't change any cacheable state — typically
 * write-only endpoints like chunk uploads and bundle assembly. Invalidation
 * on these would pointlessly sweep the org's cache on every chunk of a
 * sourcemap upload.
 */
const SKIP_INVALIDATION_PATTERNS: readonly RegExp[] = [
  // Sourcemap chunk upload + bundle assemble. Both are write-only in the
  // sense that no GET endpoint reads cacheable state under these paths.
  /\/chunk-upload\//,
  /\/artifactbundle\/assemble\//,
];

/**
 * Rule for mutations whose effects cross URL trees. Patterns match
 * the path relative to `/api/0/`. `extra` returns additional
 * path-prefixes (swept under the mutation's own origin); `extraAbsolute`
 * returns absolute URL prefixes (when invalidation must cross origins,
 * e.g. region-scoped mutation clearing a cache under the control silo).
 */
type CrossEndpointRule = {
  match: RegExp;
  extra?: (matchGroups: RegExpMatchArray) => string[];
  extraAbsolute?: (
    matchGroups: RegExpMatchArray,
    ctx: { apiBaseUrl: string },
  ) => string[];
};

const CROSS_ENDPOINT_RULES: CrossEndpointRule[] = [
  // `POST teams/{org}/{team}/projects/` (create project in team) also
  // invalidates the org project list at `organizations/{org}/projects/`.
  {
    match: /^teams\/([^/]+)\/[^/]+\/projects\/?$/,
    extra: ([, org]) => [`organizations/${org}/projects/`],
  },
  // `DELETE projects/{org}/{project}/` also invalidates the org project list.
  {
    match: /^projects\/([^/]+)\/[^/]+\/?$/,
    extra: ([, org]) => [`organizations/${org}/projects/`],
  },
  // Org-scoped issue mutations at `organizations/{org}/issues/{id}/`
  // also affect the legacy global endpoint at `issues/{id}/`, which
  // `getIssue()` hits under the control-silo base URL (potentially a
  // DIFFERENT origin than the org's region URL). Must clear the
  // legacy cache too, or subsequent `getIssue()` calls serve stale
  // data.
  {
    match: /^organizations\/[^/]+\/issues\/([^/]+)\/?$/,
    extraAbsolute: ([, issueId], { apiBaseUrl }) => [
      `${apiBaseUrl.replace(TRAILING_SLASH_RE, "")}/api/0/issues/${issueId}/`,
    ],
  },
];

/**
 * Compute the full set of cache-invalidation prefixes for a mutation
 * URL.
 *
 * @param fullUrl - Fully-qualified URL of the mutation (absolute,
 *   including base). Query string is ignored.
 * @param apiBaseUrl - The host's non-region API base URL (used by rules
 *   that need to clear caches under a different origin — e.g. the
 *   legacy `/issues/{id}/` endpoint the CLI's `getIssue()` reads).
 * @returns Full-URL prefixes to sweep. Returns `[]` if the URL is
 *   not under `/api/0/` (e.g. sourcemap chunk upload to an arbitrary
 *   endpoint) or can't be parsed.
 */
export function computeInvalidationPrefixes(
  fullUrl: string,
  apiBaseUrl: string,
): string[] {
  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch {
    // Not a URL, so nothing cached under it.
    return [];
  }

  const apiIdx = parsed.pathname.indexOf(API_V0_SEGMENT);
  if (apiIdx === -1) {
    return [];
  }

  if (SKIP_INVALIDATION_PATTERNS.some((p) => p.test(parsed.pathname))) {
    return [];
  }

  const base = `${parsed.origin}${parsed.pathname.slice(0, apiIdx + API_V0_SEGMENT.length)}`;
  const relPath = parsed.pathname.slice(apiIdx + API_V0_SEGMENT.length);
  if (relPath === "") {
    return [];
  }

  const prefixes = new Set<string>();
  for (const segments of ancestorSegments(relPath)) {
    prefixes.add(`${base}${segments}`);
  }
  for (const extra of applyCrossEndpointRules(relPath, base, apiBaseUrl)) {
    prefixes.add(extra);
  }
  return [...prefixes];
}

/** Apply the cross-endpoint rule table, yielding absolute prefix URLs. */
function* applyCrossEndpointRules(
  relPath: string,
  base: string,
  apiBaseUrl: string,
): Generator<string> {
  for (const rule of CROSS_ENDPOINT_RULES) {
    const match = relPath.match(rule.match);
    if (!match) {
      continue;
    }
    for (const extra of rule.extra?.(match) ?? []) {
      yield `${base}${extra}`;
    }
    for (const absolute of rule.extraAbsolute?.(match, { apiBaseUrl }) ?? []) {
      yield absolute;
    }
  }
}

/**
 * Yield every path-prefix sequence of `relPath` in descending length,
 * stopping at the "resource owner" level (typically `{root}/{owner}/`,
 * e.g. `organizations/acme/`). The bare `organizations/` root is
 * deliberately omitted — sweeping it on every mutation would evict
 * unrelated cross-org caches, since a mutation under one org cannot
 * invalidate another org's state.
 *
 * `"organizations/acme/releases/1.0.0/deploys/"` yields:
 * - `"organizations/acme/releases/1.0.0/deploys/"`
 * - `"organizations/acme/releases/1.0.0/"`
 * - `"organizations/acme/releases/"`
 * - `"organizations/acme/"`
 *
 * Single-segment paths (e.g. `"organizations/"`) still yield themselves
 * — a mutation at the resource-owner root is rare but the sweep should
 * still clear its cache.
 */
function* ancestorSegments(relPath: string): Generator<string> {
  const trimmed = relPath.endsWith("/") ? relPath.slice(0, -1) : relPath;
  if (trimmed === "") {
    return;
  }
  const parts = trimmed.split("/");
  const floor = parts.length > 2 ? 2 : 1;
  for (let i = parts.length; i >= floor; i--) {
    yield `${parts.slice(0, i).join("/")}/`;
  }
}
