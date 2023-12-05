import {Entry, EntrySpans, EntryType} from 'sentry/types';
import {Sort} from 'sentry/utils/discover/fields';
import {useEventDetails} from 'sentry/views/starfish/queries/useEventDetails';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {SpanIndexedField} from 'sentry/views/starfish/types';

// NOTE: Fetching the top one is a bit naive, but works for now. A better
// approach might be to fetch several at a time, and let the hook consumer
// decide how to display them
export function useFullSpanFromTrace(
  group?: string,
  sorts?: Sort[],
  enabled: boolean = true,
  extraFilters: Record<string, string> = {}
) {
  const filters = {...extraFilters};

  if (group) {
    filters[SpanIndexedField.SPAN_GROUP] = group;
  }

  const indexedSpansResponse = useIndexedSpans(filters, sorts, 1, enabled);

  const firstIndexedSpan = indexedSpansResponse.data?.[0];

  const eventDetailsResponse = useEventDetails({
    eventId: firstIndexedSpan?.[SpanIndexedField.TRANSACTION_ID],
    projectSlug: firstIndexedSpan?.[SpanIndexedField.PROJECT],
  });

  const spanEntry = eventDetailsResponse.data?.entries.find(
    (entry: Entry): entry is EntrySpans => {
      return entry.type === EntryType.SPANS;
    }
  );

  const fullSpan = spanEntry?.data?.find(
    span => span.span_id === firstIndexedSpan?.[SpanIndexedField.ID]
  );

  // N.B. There isn't a great pattern for us to merge the responses together,
  // so we're only merging the three most important properties
  return {
    isLoading: indexedSpansResponse.isLoading || eventDetailsResponse.isLoading,
    isFetching: indexedSpansResponse.isFetching || eventDetailsResponse.isFetching,
    isError: indexedSpansResponse.isError || eventDetailsResponse.isError,
    data: fullSpan,
  };
}
