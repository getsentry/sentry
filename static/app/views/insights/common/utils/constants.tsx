import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {SpanIndexedField, SpanMetricsField} from 'sentry/views/insights/types';

// This constant is to be used as an arg for `getInterval`.
// 'metrics' fidelity is intended to match the granularities of stored metrics.
// This gives us the best/highest fidelity of data for minimum amount of work (don't need to merge buckets).
export const STARFISH_CHART_INTERVAL_FIDELITY = 'metrics';

export const STARFISH_FIELDS: Record<string, {outputType: AggregationOutputType}> = {
  [SpanMetricsField.SPAN_DURATION]: {
    outputType: 'duration',
  },
  [SpanMetricsField.SPAN_SELF_TIME]: {
    outputType: 'duration',
  },
  [SpanMetricsField.HTTP_RESPONSE_TRANSFER_SIZE]: {
    outputType: 'size',
  },
  [SpanMetricsField.HTTP_DECODED_RESPONSE_CONTENT_LENGTH]: {
    outputType: 'size',
  },
  [SpanMetricsField.HTTP_RESPONSE_CONTENT_LENGTH]: {
    outputType: 'size',
  },
  [SpanIndexedField.CACHE_ITEM_SIZE]: {
    outputType: 'size',
  },
  [SpanMetricsField.CACHE_ITEM_SIZE]: {
    outputType: 'size',
  },
  [SpanMetricsField.MESSAGING_MESSAGE_RECEIVE_LATENCY]: {
    outputType: 'duration',
  },
};
