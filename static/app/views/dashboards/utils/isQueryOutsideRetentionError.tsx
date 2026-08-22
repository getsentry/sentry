import {RequestError} from 'sentry/utils/requestError/requestError';

/**
 * Raised by the backend when the whole queried range predates the org's
 * retention window. See `QueryOutsideRetentionError` in `src/sentry/utils/snuba.py`,
 * surfaced as a 400 `ParseError` by `handle_query_errors` in `src/sentry/api/utils.py`.
 *
 * The response carries no error code, so the message is the only thing to match
 * on. If it ever grows a `detail.code`, switch this over to that.
 */
const QUERY_OUTSIDE_RETENTION_DETAIL =
  'Invalid date range. Please try a more recent date range.';

/**
 * Whether a failed widget query was rejected for querying outside of retention,
 * as opposed to actually failing. Callers should treat this as an empty result
 * rather than an error.
 */
export function isQueryOutsideRetentionError(error: unknown): boolean {
  if (!(error instanceof RequestError) || error.status !== 400) {
    return false;
  }

  const detail = error.responseJSON?.detail;

  return typeof detail === 'string' && detail === QUERY_OUTSIDE_RETENTION_DETAIL;
}
