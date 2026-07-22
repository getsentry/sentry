import type {TraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

/**
 * A single row from the trace metrics list endpoint
 * (`GET /organizations/{org}/trace-items/metrics/`).
 */
export interface TraceMetricListItem {
  count: number;
  /** max(timestamp_precise), in nanoseconds since the epoch. */
  lastSeen: number | null;
  name: string;
  type: TraceMetricTypeValue;
  unit: string | null;
  // Only present when `expand=context` is requested and the
  // data-browsing-attribute-context feature is enabled.
  context?: {
    brief?: string;
    // Longer-form notes; the authoring endpoint stores a single string, which
    // the list endpoint normalizes to a one-element list.
    details?: string[];
  };
}
