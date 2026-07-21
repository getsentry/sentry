import {useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SPAN_OP_BREAKDOWN_FIELDS} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {SpanProperty} from 'sentry/views/insights/types';

const FIELDS = [
  'replayId',
  'span.duration',
  'trace',
  'timestamp',
  ...SPAN_OP_BREAKDOWN_FIELDS,
] as SpanProperty[];

export function useReplaysFromTransaction({transactionName}: {transactionName: string}) {
  const {selection} = usePageFilters();

  const search = useMemo(() => {
    const s = new MutableSearch('!replayId:"" is_transaction:true');
    s.setFilterValues('transaction', [transactionName]);
    return s;
  }, [transactionName]);

  // Hard-code 90d to match the count query. There's no date selector for the replay tab.
  const pageFilters = useMemo(
    () => ({
      ...selection,
      datetime: {...selection.datetime, period: '90d', start: null, end: null},
    }),
    [selection]
  );

  const {data, isPending, error, pageLinks} = useSpans(
    {
      search,
      fields: FIELDS,
      limit: 50,
      pageFilters,
    },
    'transactionReplays'
  );

  const replayIds = useMemo(
    () => [
      ...new Set(
        (data ?? [])
          .map(row => String(row.replayId))
          .filter(id => id && id !== 'undefined')
      ),
    ],
    [data]
  );

  return {
    replayIds,
    events: data ?? [],
    isFetching: isPending,
    fetchError: error,
    pageLinks: pageLinks ?? null,
  };
}
