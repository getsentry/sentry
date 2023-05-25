import {useQuery} from '@tanstack/react-query';

import {COL_WIDTH_UNDEFINED, GridColumnOrder} from 'sentry/components/gridEditable';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {
  getSpanListQuery,
  getSpansTrendsQuery,
} from 'sentry/views/starfish/views/spans/queries';
import SpansTable, {
  SpanDataRow,
  SpanTrendDataRow,
} from 'sentry/views/starfish/views/spans/spansTable';

const COLUMN_ORDER: GridColumnOrder[] = [
  {
    key: 'span_operation',
    name: 'Operation',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'description',
    name: 'Span Description',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'throughput_trend',
    name: 'throughput (spm)',
    width: 175,
  },
  {
    key: 'p50_trend',
    name: 'p50',
    width: 175,
  },
  {
    key: 'p95_trend',
    name: 'p95',
    width: 175,
  },
];

export function GenericSpansTable({transaction}: {transaction?: string}) {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const queryConditions = [`transaction = '${transaction}'`];
  const orderBy = '-sum(exclusive_time), -count()';

  const {isLoading: areSpansLoading, data: spansData} = useQuery<SpanDataRow[]>({
    queryKey: ['spans', pageFilter.selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpanListQuery(
          undefined,
          pageFilter.selection.datetime,
          queryConditions,
          orderBy,
          8
        )}`
      ).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: [],
  });

  const groupIDs = spansData.map(({group_id}) => group_id);

  const {isLoading: areSpansTrendsLoading, data: spansTrendsData} = useQuery<
    SpanTrendDataRow[]
  >({
    queryKey: ['spansTrends'],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpansTrendsQuery(
          undefined,
          pageFilter.selection.datetime,
          groupIDs
        )}`
      ).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: [],
    enabled: groupIDs.length > 0,
  });

  return (
    <SpansTable
      columnOrder={COLUMN_ORDER}
      location={location}
      queryConditions={queryConditions}
      isLoading={areSpansLoading || areSpansTrendsLoading}
      spansData={spansData}
      orderBy={orderBy}
      onSetOrderBy={() => null}
      spansTrendsData={spansTrendsData}
      onSelect={() => null}
    />
  );
}
