import type {z} from 'zod';

const MAX_VALUE_PREVIEW = 80;

interface InvalidEmbedReport {
  /**
   * One line per failure: the field, what was wrong, and what arrived.
   * Plain strings, so the SDK's default normalize depth cannot collapse them.
   */
  failures: string[];
  /** Stable per cause, so different mistakes group into different issues. */
  fingerprint: string[];
  /** The failing fields, comma separated -- searchable as a tag. */
  invalidFields: string;
  /**
   * Unexpected keys that look like a missing field under another spelling,
   * e.g. `trace_id -> traceId`.
   */
  likelyRenames: string[];
  /** Every top-level key the embed received. */
  receivedKeys: string[];
  title: string;
  /** Keys the schema does not declare, which zod silently strips. */
  unexpectedKeys: string[];
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.length === 0 ? '(root)' : path.map(String).join('.');
}

function getAtPath(data: unknown, path: readonly PropertyKey[]): unknown {
  let value = data;
  for (const key of path) {
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    value = (value as Record<PropertyKey, unknown>)[key];
  }
  return value;
}

function previewValue(value: unknown): string {
  if (value === undefined) {
    return 'missing';
  }
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }
  if (typeof value === 'object') {
    return `object{${Object.keys(value).join(', ')}}`;
  }
  // A string previews quoted; anything else is labelled with its type, since
  // `5` and `"5"` fail a schema for different reasons.
  // Bodies come from JSON.parse, so only JSON primitives reach here.
  const text = JSON.stringify(value) ?? typeof value;
  const truncated =
    text.length > MAX_VALUE_PREVIEW ? `${text.slice(0, MAX_VALUE_PREVIEW)}…` : text;
  return typeof value === 'string' ? truncated : `${typeof value} ${truncated}`;
}

function describeExpectation(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return `expected ${issue.expected}`;
    case 'invalid_format':
      return `expected ${issue.format} format`;
    case 'invalid_value':
      return `expected one of ${issue.values.map(v => JSON.stringify(v)).join(', ')}`;
    default:
      return issue.message;
  }
}

/** `trace_id`, `TraceId` and `trace-id` all normalize to `traceid`. */
function normalizeKey(key: string): string {
  return key.replace(/[_-]/g, '').toLowerCase();
}

/**
 * Turns a failed parse into something a reader can act on: which fields
 * failed, what arrived in them, and which keys the agent sent that the schema
 * does not know -- the usual sign it guessed at a field name.
 */
export function describeInvalidEmbed(
  name: string,
  schema: z.ZodType,
  data: unknown,
  issues: readonly z.core.$ZodIssue[]
): InvalidEmbedReport {
  const isRecord = typeof data === 'object' && data !== null && !Array.isArray(data);
  const receivedKeys = isRecord ? Object.keys(data) : [];
  const shape = 'shape' in schema ? (schema.shape as Record<string, unknown>) : null;
  const unexpectedKeys = shape ? receivedKeys.filter(key => !(key in shape)) : [];

  const paths = [...new Set(issues.map(issue => formatPath(issue.path)))];

  const failures = issues.map(issue => {
    const path = formatPath(issue.path);
    const received = previewValue(getAtPath(data, issue.path));
    return `${path}: ${describeExpectation(issue)}, received ${received}`;
  });

  const missingKeys = issues
    .filter(issue => issue.path.length === 1 && getAtPath(data, issue.path) === undefined)
    .map(issue => String(issue.path[0]));
  const likelyRenames = missingKeys.flatMap(missing =>
    unexpectedKeys
      .filter(key => normalizeKey(key) === normalizeKey(missing))
      .map(key => `${key} -> ${missing}`)
  );

  // A field that never arrived and one that arrived malformed need different
  // fixes, so they fingerprint apart even though zod reports both as a type error.
  const signature = [
    ...new Set(
      issues.map(issue => {
        const cause = getAtPath(data, issue.path) === undefined ? 'missing' : issue.code;
        return `${formatPath(issue.path)}:${cause}`;
      })
    ),
  ].sort();

  return {
    title: `[SeerEmbed] ${name}: invalid props (${paths.join(', ')})`,
    fingerprint: ['seer-embed-invalid-props', name, ...signature],
    // Tag values are capped at 200 characters.
    invalidFields: paths.join(',').slice(0, 200),
    failures,
    receivedKeys,
    unexpectedKeys,
    likelyRenames,
  };
}
