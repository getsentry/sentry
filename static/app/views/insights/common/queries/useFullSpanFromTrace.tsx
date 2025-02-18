import type {Entry, EntrySpans} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Sort} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {useEventDetails} from 'sentry/views/insights/common/queries/useEventDetails';
import {SpanIndexedField, type SpanIndexedProperty} from 'sentry/views/insights/types';

const DEFAULT_SORT: Sort[] = [{field: 'timestamp', kind: 'desc'}];

// NOTE: Fetching the top one is a bit naive, but works for now. A better
// approach might be to fetch several at a time, and let the hook consumer
// decide how to display them
export function useFullSpanFromTrace(
  group?: string,
  sorts?: Sort[],
  enabled = true,
  extraFilters: Record<string, string> = {}
) {
  const filters = {...extraFilters};

  if (group) {
    filters[SpanIndexedField.SPAN_GROUP] = group;
  }

  const indexedSpansResponse = useSpansIndexed(
    {
      search: MutableSearch.fromQueryObject(filters),
      sorts: sorts || DEFAULT_SORT,
      limit: 1,
      enabled,
      fields: [
        SpanIndexedField.TIMESTAMP,
        SpanIndexedField.TRANSACTION_ID,
        SpanIndexedField.PROJECT,
        SpanIndexedField.SPAN_ID,
        ...(sorts?.map(sort => sort.field as SpanIndexedProperty) || []),
      ],
    },
    'api.starfish.full-span-from-trace'
  );

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
    span => span.span_id === firstIndexedSpan?.[SpanIndexedField.SPAN_ID]
  );

  // N.B. There isn't a great pattern for us to merge the responses together,
  // so we're only merging the three most important properties
  return {
    isLoading: indexedSpansResponse.isPending || eventDetailsResponse.isPending,
    isFetching: indexedSpansResponse.isFetching || eventDetailsResponse.isFetching,
    isError: indexedSpansResponse.isError || eventDetailsResponse.isError,
    data: fullSpan,
  };
}
