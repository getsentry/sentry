import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';

/**
 * Minimal structural span shape these pure metric helpers need. Compatible with
 * both the UI's `Span` (spanEvidenceKeyValueList) and the markdown formatter's
 * `EvidenceSpan`, so the same helpers serve both and stay a single source of
 * truth. Kept dependency-free (no React/emotion/theme) so it's cheap to import
 * anywhere.
 */
type SpanMetricInput =
  | {
      data?: Record<string, any>;
      start_timestamp?: number;
      timestamp?: number;
    }
  | null
  | undefined;

/** Span duration in milliseconds. */
export function getSpanDuration(span: SpanMetricInput): number {
  return ((span?.timestamp ?? 0) - (span?.start_timestamp ?? 0)) * 1000;
}

export function getSpanDataField(span: SpanMetricInput, field: string): any {
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
