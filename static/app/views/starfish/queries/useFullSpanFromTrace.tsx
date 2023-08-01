import {useEventJSON} from 'sentry/views/starfish/queries/useEventJSON';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {SpanIndexedFields} from 'sentry/views/starfish/types';

// NOTE: Fetching the top one is a bit naive, but works for now. A better
// approach might be to fetch several at a time, and let the hook consumer
// decide how to display them
export function useFullSpanFromTrace(group: string) {
  const {data: indexedSpans} = useIndexedSpans(
    {
      [SpanIndexedFields.SPAN_GROUP]: group,
    },
    1
  );

  const firstIndexedSpan = indexedSpans?.[0];

  const response = useEventJSON(
    firstIndexedSpan ? firstIndexedSpan[SpanIndexedFields.TRANSACTION_ID] : undefined,
    firstIndexedSpan ? firstIndexedSpan[SpanIndexedFields.PROJECT] : undefined
  );

  const fullSpan = response?.data?.spans?.find(
    span => span.span_id === firstIndexedSpan?.[SpanIndexedFields.ID]
  );

  return {
    ...response,
    data: fullSpan,
  };
}
