import {EventTransaction} from 'sentry/types';

import {RawSpanType} from '../spans/types';

export function getSpanChangeDetails(affectedSpanIds: string[], event: EventTransaction) {
  const transactionDuration = parseFloat(
    Math.round((event.endTimestamp - event.startTimestamp) * 1000).toFixed(1)
  );

  const spanSet = new Set(affectedSpanIds);

  // Calculate the cumulative duration of the affected spans
  // Iterate through the entire event by using .reduce, sum up the duration of the spans
  const eventSpans = event.entries as unknown as RawSpanType[];
  const spanDuration = eventSpans.reduce((acc: number, span: RawSpanType) => {
    if (spanSet.has(span.span_id)) {
      acc += span.timestamp - span.start_timestamp;
    }

    return acc;
  }, 0);

  return {transactionDuration, spanDuration};
}
