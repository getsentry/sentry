/**
 * Normalizes verbose English sentence operationIds in the OpenAPI spec to short,
 * REST-conventional camelCase identifiers.
 *
 * Rules:
 *   GET  /…/collection/          → list{Resource}s
 *   GET  /…/collection/{id}/     → get{Resource}       (singularize last segment)
 *   POST /…/collection/          → create{Resource}    (singular — creating one item)
 *   PUT/PATCH /…/resource/{id}/  → update{Resource}
 *   DELETE /…/resource/{id}/     → delete{Resource}
 *   DELETE /…/collection/        → delete{Resource}s   (bulk)
 *
 * Any operationId that is already an identifier (no spaces) is left untouched —
 * those were set intentionally via @extend_schema(operation_id=...).
 *
 * It also drops `format: uint64`, and `format: int64` from integer schemas
 * whose bounds fit in a JS number, so the generated validators match the
 * generated `number` types.
 */

import { readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Singularization
// ---------------------------------------------------------------------------

const IRREGULAR = {
  activities: "activity",
  queries: "query",
  aliases: "alias",
  indices: "index",
  statuses: "status",
  checkins: "checkin",
  analyses: "analysis",
};

/**
 * Returns the singular form of a lowercase English noun.
 *
 * Handles the most common patterns found in Sentry API path segments.
 * Returns the word unchanged when no rule applies or when slicing would
 * produce an empty string (e.g. the single-character input "s").
 *
 * @param {string} word - Lowercase noun, e.g. "issues", "activities"
 * @returns {string} Singular form, e.g. "issue", "activity"
 */
export function singularize(word) {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  // -shes → -sh, -ches → -ch, -xes → -x, -zes → -z
  if (/(?:sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  // -ses → strip s (releases → release), but -sses → strip es (classes → class)
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ses")) return word.slice(0, -1);
  // Skip -ss (class), -us (status), -is (analysis), -as (alias) — already singular.
  if (
    word.endsWith("s") &&
    !word.endsWith("ss") &&
    !word.endsWith("us") &&
    !word.endsWith("is") &&
    !word.endsWith("as")
  ) {
    const stem = word.slice(0, -1);
    return stem.length > 0 ? stem : word;
  }
  return word;
}

// ---------------------------------------------------------------------------
// Path parsing
// ---------------------------------------------------------------------------

/**
 * Splits a path segment into its words on hyphen/underscore boundaries.
 * Empty words from consecutive or trailing separators (e.g. "foo--bar") are
 * dropped so downstream camelCasing never sees an empty string.
 */
function splitWords(s) {
  return s.split(/[-_]/).filter(Boolean);
}

/** Joins words into camelCase: ["events", "timeseries"] → "eventsTimeseries" */
function camelJoin(words) {
  return words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join("");
}

/**
 * Converts a path segment to camelCase, optionally singularizing its last word.
 *
 * Singularizing the *last word* (not the full camelCase string) is critical for
 * compound segments: "release-threshold-statuses" must become
 * "releaseThresholdStatus", not "releaseThresholdStatuse". Splitting first means
 * singularize() receives the bare word "statuses" and can match the IRREGULAR table.
 *
 * Both `value` and `singularValue` go through this single path so they can never
 * diverge on separator handling.
 */
function segmentToCamel(s, { singular } = {}) {
  const words = splitWords(s);
  if (singular && words.length > 0) {
    words[words.length - 1] = singularize(words[words.length - 1]);
  }
  return camelJoin(words);
}

/**
 * Parses an API path into an array of segment descriptors.
 *
 * Each descriptor carries:
 *   - `value`: the segment converted to camelCase (plural kept)
 *   - `singularValue`: the segment with its last word singularized, then camelCased
 *   - `isParam`: true when the segment is a path parameter ({…})
 *   - `followedByParam`: true when the next segment is a path parameter
 *
 * Empty segments (from leading/double slashes) are dropped upfront.
 *
 * @param {string} path - e.g. "/api/0/organizations/{org}/issues/{id}/"
 * @returns {{ value: string; singularValue: string; isParam: boolean; followedByParam: boolean }[]}
 */
export function parsePath(path) {
  const clean = path.replace(/^\/api\/0\//, "").replace(/\/$/, "");
  const raw = clean.split("/").filter((s) => s.length > 0);

  return raw.map((s, i) => {
    const isParam = s.startsWith("{");
    return {
      value:         isParam ? s : segmentToCamel(s),
      singularValue: isParam ? s : segmentToCamel(s, { singular: true }),
      isParam,
      followedByParam: raw[i + 1]?.startsWith("{") ?? false,
    };
  });
}

// ---------------------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------------------

const VERBS = {
  post: "create",
  put: "update",
  patch: "update",
  delete: "delete",
};

/**
 * Derives a short, REST-conventional camelCase identifier from an HTTP method
 * and URL path.
 *
 * @param {string} method - HTTP method (lowercase: "get", "post", …)
 * @param {string} path   - Full path, e.g. "/api/0/organizations/{org}/issues/{id}/"
 * @returns {string} Normalized identifier, e.g. "getOrganizationIssue"
 * @throws {Error} If the path produces no usable resource name (no static
 *   segments, or only separator-character segments)
 */
export function normalizeOperationId(method, path) {
  const segments = parsePath(path);
  const statics = segments.filter((s) => !s.isParam);
  const isDetail = segments.at(-1)?.isParam ?? false;
  const verb = method === "get" ? (isDetail ? "get" : "list") : (VERBS[method] ?? method);

  // Apply singularization in a single pass:
  //   - any segment immediately before a {param} scopes a specific resource
  //   - the final segment for detail GETs and creates (operating on one item)
  const parts = statics
    .map((s, i) => {
      const isLast = i === statics.length - 1;
      const needsSingular = s.followedByParam || (isLast && (isDetail || verb === "create"));
      return needsSingular ? s.singularValue : s.value;
    })
    .filter(Boolean); // drop all-separator segments (e.g. "---") that camelCase to ""

  const resource = camelJoin(parts);

  // Guard the real invariant: the assembled resource must be non-empty. This
  // covers a path with no static segments and one whose only static segments
  // are separators (e.g. "/---/"); interior separator segments are dropped by
  // the filter above so they can't crash the camelJoin assembly.
  if (resource.length === 0) {
    throw new Error(
      `normalizeOperationId: path "${path}" (${method.toUpperCase()}) has no ` +
        `usable static segments. Set operation_id explicitly via ` +
        `@extend_schema(operation_id=...).`,
    );
  }

  return verb + resource[0].toUpperCase() + resource.slice(1);
}

// ---------------------------------------------------------------------------
// Spec rewriting
// ---------------------------------------------------------------------------

/**
 * Removes `format: int64` from integer schemas bounded within the safe integer
 * range. Hey API types int64 as `number` but makes the Valibot and Zod schemas
 * coerce to `bigint`, so a bounded field such as a UInt32 (which needs int64
 * in OpenAPI) would validate to a different type than the SDK accepts.
 *
 * Also removes every `format: uint64`. Hey API types it as `number` too, and
 * its schemas coerce to `bigint` with `BigInt(…)` bounds that run at import
 * time. These fields describe JSON numbers (such as event context sizes),
 * which `JSON.parse` already reads as `number`.
 */
function dropNumberSafeFormats(node) {
  if (Array.isArray(node)) {
    node.forEach(dropNumberSafeFormats);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  if (
    node.type === "integer"
    && (
      node.format === "uint64"
      || (
        node.format === "int64"
        && Number.isSafeInteger(node.minimum)
        && Number.isSafeInteger(node.maximum)
      )
    )
  ) {
    delete node.format;
  }
  Object.values(node).forEach(dropNumberSafeFormats);
}

/**
 * Reads the spec at `inputPath`, rewrites all sentence-style operationIds to
 * short REST-conventional names, drops uint64 formats and int64 formats from
 * integers that fit in a JS number, and writes the result to `outputPath`.
 *
 * Throws on name collisions — two operations normalizing to the same identifier
 * would produce duplicate SDK exports, which must be resolved explicitly via
 * @extend_schema(operation_id=...) on the backend endpoint.
 *
 * @param {string} inputPath  - Path to the source spec (e.g. openapi-derefed.json)
 * @param {string} outputPath - Path to write the normalized spec to
 */
export function normalizeSpec(inputPath, outputPath) {
  // JSON.parse produces a fresh object every call; mutations are safe and
  // intentional — we rewrite operationIds in place before serialising.
  const spec = JSON.parse(readFileSync(inputPath, "utf8"));
  // Track every final operationId (rewritten or pre-existing) so that a manually
  // set clean identifier cannot collide with a path-derived one without detection.
  const seen = new Map(); // final operationId → "METHOD /path" that first claimed it

  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (typeof op !== "object" || op === null || !op.operationId) continue;

      const ref = `${method.toUpperCase()} ${path}`;

      if (!/\s/.test(op.operationId)) {
        // Already a clean identifier — register it so sentence-style rewrites
        // on other paths cannot silently collide with it.
        const claimedBy = seen.get(op.operationId);
        if (claimedBy) {
          throw new Error(
            `normalizeSpec: collision — "${op.operationId}" claimed by both ` +
              `"${claimedBy}" and "${ref}". ` +
              `Set operation_id explicitly on one of them via @extend_schema(operation_id=...).`,
          );
        }
        seen.set(op.operationId, ref);
        continue;
      }

      const normalized = normalizeOperationId(method, path);
      const claimedBy = seen.get(normalized);
      if (claimedBy) {
        throw new Error(
          `normalizeSpec: collision — "${normalized}" claimed by both ` +
            `"${claimedBy}" and "${ref}". ` +
            `Set operation_id explicitly on one of them via @extend_schema(operation_id=...).`,
        );
      }
      seen.set(normalized, ref);
      op.operationId = normalized;
    }
  }

  dropNumberSafeFormats(spec);
  writeFileSync(outputPath, JSON.stringify(spec));
  return spec;
}
