import {Fragment, useCallback, useMemo, useState} from 'react';
import {browserHistory, Link} from 'react-router';
import styled from '@emotion/styled';

import CompactSelect from 'sentry/components/compactSelect';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {renderTableHead} from 'sentry/utils/profiling/tableRenderer';
import {makeFormatter} from 'sentry/utils/profiling/units/units';
import {decodeScalar} from 'sentry/utils/queryString';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';

import {useProfileGroup} from '../../profileGroupProvider';
import {useColumnFilters} from '../hooks/useColumnFilters';
import {useFuseSearch} from '../hooks/useFuseSearch';
import {usePageLinks} from '../hooks/usePageLinks';
import {useSortableColumns} from '../hooks/useSortableColumn';
import {collectProfileFrames} from '../utils';

const RESULTS_PER_PAGE = 50;

export function SlowestFunctions() {
  const location = useLocation();
  const [state] = useProfileGroup();

  const cursor = useMemo<number>(() => {
    const cursorQuery = decodeScalar(location.query.cursor, '');
    return parseInt(cursorQuery, 10) || 0;
  }, [location.query.cursor]);

  const query = useMemo<string>(() => decodeScalar(location.query.query, ''), [location]);

  const allFunctions: TableDataRow[] = useMemo(() => {
    return state.type === 'resolved'
      ? state.data.profiles
          .flatMap(collectProfileFrames)
          // Take only the first 500
          .slice(0, 500)
          // Self weight desc sort
          .sort((a, b) => b['self weight'] - a['self weight'])
      : [];
  }, [state]);

  const {search} = useFuseSearch(allFunctions, {
    keys: ['symbol'],
    threshold: 0.3,
  });

  const [slowestFunctions, setSlowestFunctions] = useState<TableDataRow[]>(() => {
    return search(query);
  });

  useEffectAfterFirstRender(() => {
    setSlowestFunctions(search(query));
  }, [allFunctions, query, search]);

  const pageLinks = usePageLinks(slowestFunctions, cursor);

  const {filters, columnFilters, filterPredicate} = useColumnFilters(slowestFunctions, [
    'type',
    'image',
  ]);

  const {currentSort, generateSortLink, sortCompareFn} = useSortableColumns({
    sortableColumns: SORTABLE_COLUMNS,
    querystringKey: 'functionsSort',
    defaultSort: {
      key: 'self weight' as TableColumnKey,
      order: 'desc',
    },
  });

  const handleSearch = useCallback(
    searchString => {
      browserHistory.replace({
        ...location,
        query: {
          ...location.query,
          query: searchString,
          cursor: undefined,
        },
      });

      setSlowestFunctions(search(searchString));
    },
    [location, search]
  );

  const data = slowestFunctions
    .filter(filterPredicate)
    .sort(sortCompareFn)
    .slice(cursor, cursor + RESULTS_PER_PAGE);

  return (
    <Fragment>
      <ActionBar>
        <CompactSelect
          options={[{label: 'None', value: 'none'}]}
          value="none"
          triggerProps={{
            prefix: t('Group by'),
          }}
          placement="bottom right"
        />
        <SearchBar
          defaultQuery=""
          query={query}
          placeholder={t('Search for frames')}
          onChange={handleSearch}
        />

        <CompactSelect
          options={columnFilters.type.values.map(value => ({value, label: value}))}
          value={filters.type}
          triggerLabel={
            !filters.type ||
            (Array.isArray(filters.type) &&
              filters.type.length === columnFilters.type.values.length)
              ? t('All')
              : undefined
          }
          triggerProps={{
            prefix: t('Type'),
          }}
          multiple
          onChange={columnFilters.type.onChange}
          placement="bottom right"
        />
        <CompactSelect
          options={columnFilters.image.values.map(value => ({value, label: value}))}
          value={filters.image}
          triggerLabel={
            !filters.image ||
            (Array.isArray(filters.image) &&
              filters.image.length === columnFilters.image.values.length)
              ? t('All')
              : undefined
          }
          triggerProps={{
            prefix: t('Package'),
          }}
          multiple
          onChange={columnFilters.image.onChange}
          placement="bottom right"
        />
      </ActionBar>

      <GridEditable
        title={t('Slowest Functions by Occurrence')}
        isLoading={state.type === 'loading'}
        error={state.type === 'errored'}
        data={data}
        columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
        columnSortBy={[currentSort]}
        grid={{
          renderHeadCell: renderTableHead({
            rightAlignedColumns: RIGHT_ALIGNED_COLUMNS,
            sortableColumns: RIGHT_ALIGNED_COLUMNS,
            currentSort,
            generateSortLink,
          }),
          renderBodyCell: renderFunctionCell,
        }}
        location={location}
      />

      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

const RIGHT_ALIGNED_COLUMNS = new Set<TableColumnKey>(['self weight', 'total weight']);
const SORTABLE_COLUMNS = new Set<TableColumnKey>(['self weight', 'total weight']);

const ActionBar = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

function renderFunctionCell(
  column: TableColumn,
  dataRow: TableDataRow,
  rowIndex: number,
  columnIndex: number
) {
  return (
    <ProfilingFunctionsTableCell
      column={column}
      dataRow={dataRow}
      rowIndex={rowIndex}
      columnIndex={columnIndex}
    />
  );
}

interface ProfilingFunctionsTableCellProps {
  column: TableColumn;
  columnIndex: number;
  dataRow: TableDataRow;
  rowIndex: number;
}

const formatter = makeFormatter('nanoseconds');
function ProfilingFunctionsTableCell({
  column,
  dataRow,
}: ProfilingFunctionsTableCellProps) {
  const value = dataRow[column.key];
  const {orgId, projectId, eventId} = useParams();

  switch (column.key) {
    case 'self weight':
      return <NumberContainer>{formatter(value)}</NumberContainer>;
    case 'total weight':
      return <NumberContainer>{formatter(value)}</NumberContainer>;
    case 'image':
      return <Container>{value ?? 'Unknown'}</Container>;
    case 'thread': {
      return (
        <Container>
          <Link
            to={generateProfileFlamechartRouteWithQuery({
              orgSlug: orgId,
              projectSlug: projectId,
              profileId: eventId,
              query: {tid: dataRow.thread},
            })}
          >
            {value}
          </Link>
        </Container>
      );
    }
    default:
      return <Container>{value}</Container>;
  }
}

const tableColumnKey = [
  'symbol',
  'image',
  'file',
  'thread',
  'type',
  'self weight',
  'total weight',
] as const;

type TableColumnKey = typeof tableColumnKey[number];

type TableDataRow = Record<TableColumnKey, any>;

type TableColumn = GridColumnOrder<TableColumnKey>;

const COLUMN_ORDER: TableColumnKey[] = [
  'symbol',
  'image',
  'file',
  'thread',
  'type',
  'self weight',
  'total weight',
];

// TODO: looks like these column names change depending on the platform?
const COLUMNS: Record<TableColumnKey, TableColumn> = {
  symbol: {
    key: 'symbol',
    name: t('Symbol'),
    width: COL_WIDTH_UNDEFINED,
  },
  image: {
    key: 'image',
    name: t('Package'),
    width: COL_WIDTH_UNDEFINED,
  },
  file: {
    key: 'file',
    name: t('File'),
    width: COL_WIDTH_UNDEFINED,
  },
  thread: {
    key: 'thread',
    name: t('Thread'),
    width: COL_WIDTH_UNDEFINED,
  },
  type: {
    key: 'type',
    name: t('Type'),
    width: COL_WIDTH_UNDEFINED,
  },
  'self weight': {
    key: 'self weight',
    name: t('Self Weight'),
    width: COL_WIDTH_UNDEFINED,
  },
  'total weight': {
    key: 'total weight',
    name: t('Total Weight'),
    width: COL_WIDTH_UNDEFINED,
  },
};
