import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {SpanFields} from 'sentry/views/insights/types';

// This constant is to be used as an arg for `getInterval`.
// 'metrics' fidelity is intended to match the granularities of stored metrics.
// This gives us the best/highest fidelity of data for minimum amount of work (don't need to merge buckets).
export const STARFISH_CHART_INTERVAL_FIDELITY = 'metrics';

export const STARFISH_FIELDS: Record<string, {outputType: AggregationOutputType}> = {
  [SpanFields.SPAN_DURATION]: {
    outputType: 'duration',
  },
  [SpanFields.SPAN_SELF_TIME]: {
    outputType: 'duration',
  },
  [SpanFields.HTTP_RESPONSE_TRANSFER_SIZE]: {
    outputType: 'size',
  },
  [SpanFields.HTTP_DECODED_RESPONSE_CONTENT_LENGTH]: {
    outputType: 'size',
  },
  [SpanFields.HTTP_RESPONSE_CONTENT_LENGTH]: {
    outputType: 'size',
  },
  [SpanFields.CACHE_ITEM_SIZE]: {
    outputType: 'size',
  },
  [SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY]: {
    outputType: 'duration',
  },
};
