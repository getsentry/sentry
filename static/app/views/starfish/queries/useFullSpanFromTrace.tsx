import {useEventJSON} from 'sentry/views/starfish/queries/useEventJSON';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {SpanIndexedFields} from 'sentry/views/starfish/types';

// NOTE: Fetching the top one is a bit naive, but works for now. A better
// approach might be to fetch several at a time, and let the hook consumer
// decide how to display them
export function useFullSpanFromTrace(group?: string, enabled: boolean = true) {
  const filters: {[key: string]: string} = {};

  if (group) {
    filters[SpanIndexedFields.SPAN_GROUP] = group;
  }

  const indexedSpansResponse = useIndexedSpans(filters, 1, enabled);

  const firstIndexedSpan = indexedSpansResponse.data?.[0];

  const eventJSONResponse = useEventJSON(
    firstIndexedSpan ? firstIndexedSpan[SpanIndexedFields.TRANSACTION_ID] : undefined,
    firstIndexedSpan ? firstIndexedSpan[SpanIndexedFields.PROJECT] : undefined
  );

  const fullSpan = eventJSONResponse?.data?.spans?.find(
    span => span.span_id === firstIndexedSpan?.[SpanIndexedFields.ID]
  );

  // N.B. There isn't a great pattern for us to merge the responses together,
  // so we're only merging the three most important properties
  return {
    isLoading: indexedSpansResponse.isLoading || eventJSONResponse.isLoading,
    isFetching: indexedSpansResponse.isFetching || eventJSONResponse.isFetching,
    isError: indexedSpansResponse.isError || eventJSONResponse.isError,
    data: fullSpan,
  };
}
