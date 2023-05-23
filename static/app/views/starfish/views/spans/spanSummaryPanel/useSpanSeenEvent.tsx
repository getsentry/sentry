import {useQuery} from 'sentry/utils/queryClient';
import {useQueryGetEvent} from 'sentry/views/starfish/modules/databaseModule/queries';
import {HOST} from 'sentry/views/starfish/utils/constants';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';

type HasTransaction = {
  transaction_id: string;
};

function useFirstSeenSpan(span?: Span, referrer = 'first-seen-span') {
  const query = span
    ? `
    SELECT transaction_id
    FROM spans_experimental_starfish
    WHERE group_id = '${span.group_id}'
    ORDER BY start_timestamp ASC
    LIMIT 1
 `
    : null;

  const result = useQuery<(Span & HasTransaction)[]>({
    queryKey: ['span', 'first', span?.group_id],
    queryFn: () =>
      fetch(`${HOST}/?query=${query}&referrer=${referrer}`).then(res => res.json()),
    retry: false,
    initialData: [],
    enabled: Boolean(span),
  });

  return {...result, data: result.data[0]};
}

export const useSpanFirstSeenEvent = (
  span?: Span,
  referrer = 'span-first-seen-event'
) => {
  const {data} = useFirstSeenSpan(span, referrer);
  return useQueryGetEvent(data?.transaction_id);
};

function useLastSeenSpan(span?: Span, referrer = 'last-seen-span') {
  const query = span
    ? `
    SELECT transaction_id
    FROM spans_experimental_starfish
    WHERE group_id = '${span.group_id}'
    ORDER BY start_timestamp DESC
    LIMIT 1
 `
    : null;

  const result = useQuery<(Span & HasTransaction)[]>({
    queryKey: ['span', 'last', span?.group_id],
    queryFn: () =>
      fetch(`${HOST}/?query=${query}&referrer=${referrer}`).then(res => res.json()),
    retry: false,
    initialData: [],
    enabled: Boolean(span),
  });

  return {...result, data: result.data[0]};
}

export const useSpanLastSeenEvent = (span?: Span, referrer = 'span-last-seen-event') => {
  const {data} = useLastSeenSpan(span, referrer);
  return useQueryGetEvent(data?.transaction_id);
};
