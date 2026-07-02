import mapValues from 'lodash/mapValues';

import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {safeURL} from 'sentry/utils/url/safeURL';

/**
 * Minimal structural span shape these pure metric helpers need. Compatible with
 * both the UI's `Span` (spanEvidenceKeyValueList) and the markdown formatter's
 * `EvidenceSpan`, so the same helpers serve both and stay a single source of
 * truth. Kept dependency-free (no React/emotion/theme) so it's cheap to import
 * anywhere.
 */
type SpanMetricInput =
  | {
      // Allow the full span object (span_id, op, hash, etc.) — these helpers
      // only read the fields below.
      [key: string]: unknown;
      data?: Record<string, any>;
      description?: string;
      start_timestamp?: number;
      timestamp?: number;
    }
  | null
  | undefined;

type ParameterLookup = Record<string, string[]>;

/** Span duration in milliseconds. */
export function getSpanDuration(span: SpanMetricInput): number {
  return ((span?.timestamp ?? 0) - (span?.start_timestamp ?? 0)) * 1000;
}

function getSpanDataField(span: SpanMetricInput, field: string): any {
  return span?.data?.[field];
}

/** A `span.data` byte field formatted as e.g. "4.8 MiB (5000000 B)". */
export function getSpanFieldBytes(span: SpanMetricInput, field: string): string | null {
  const bytes = getSpanDataField(span, field);
  if (!bytes) {
    return null;
  }
  return `${formatBytesBase2(bytes)} (${bytes} B)`;
}

/**
 * Parses the span data and pulls out the URL. Accounts for different SDKs and
 * different versions of SDKs formatting and parsing the URL contents
 * differently. Mirror of `get_url_from_span`. Ideally, this should not exist,
 * and instead it should use the data provided by the backend.
 */
export function extractSpanURLString(
  span: SpanMetricInput,
  baseURL?: string
): URL | null {
  let url = span?.data?.url;
  if (url) {
    const query = span?.data?.['http.query'];
    if (query) {
      url += `?${query}`;
    }

    const parsedURL = safeURL(url, baseURL);
    if (parsedURL) {
      return parsedURL;
    }
  }

  const [_method, _url] = (span?.description ?? '').split(' ', 2) as [string, string];

  return safeURL(_url, baseURL) ?? null;
}

export function extractQueryParameters(URLs: URL[]): ParameterLookup {
  const parameterValuesByKey: ParameterLookup = {};

  URLs.forEach(url => {
    for (const [key, value] of url.searchParams) {
      parameterValuesByKey[key] ??= [];
      parameterValuesByKey[key].push(value);
    }
  });

  return mapValues(parameterValuesByKey, parameterList => {
    return Array.from(new Set(parameterList));
  });
}

/**
 * Condensed description of the query parameters that change between the URLs of
 * the given spans, e.g. "id:{1,2,3}". Used as the fallback for N+1 API calls
 * when the backend didn't pre-compute `evidenceData.parameters`.
 */
export function formatChangingQueryParameters(
  spans: SpanMetricInput[],
  baseURL?: string
): string[] {
  const URLs = spans
    .map(span => extractSpanURLString(span, baseURL))
    .filter((url): url is URL => url instanceof URL);

  const allQueryParameters = extractQueryParameters(URLs);

  const pairs: string[] = [];
  for (const key in allQueryParameters) {
    const values = allQueryParameters[key]!;

    // By definition, if the parameter only has one value that means it's not
    // changing between calls, so omit it!
    if (values.length > 1) {
      pairs.push(`${key}:{${values.join(',')}}`);
    }
  }

  return pairs;
}
