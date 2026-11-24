import type {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import * as qs from 'sentry/utils/url/qs';

export interface ConversationTrace {
  /** A span within the trace, used to focus the trace view on the conversation. */
  spanId: string;
  traceId: string;
  /** Start of that span in seconds, so the trace view queries the right time window. */
  timestamp?: number;
}

/**
 * Without a timestamp or date range, the trace view queries a relative default
 * period and fails to find traces older than it, so always send one.
 */
export function getConversationTraceUrl(
  orgSlug: string,
  {traceId, spanId, timestamp}: ConversationTrace,
  dateSelection: ReturnType<typeof normalizeDateTimeParams>
) {
  const query = {
    node: `span-${spanId}`,
    ...(timestamp === undefined ? dateSelection : {timestamp}),
  };
  return normalizeUrl(
    `/organizations/${orgSlug}/explore/traces/trace/${traceId}/?${qs.stringify(query)}`
  );
}
