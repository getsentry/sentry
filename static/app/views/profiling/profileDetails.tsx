import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {browserHistory, Link} from 'react-router';
import styled from '@emotion/styled';
import Fuse from 'fuse.js';
import * as qs from 'query-string';

import CompactSelect from 'sentry/components/compactSelect';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {renderTableHead} from 'sentry/utils/profiling/tableRenderer';
import {makeFormatter} from 'sentry/utils/profiling/units/units';
import {decodeScalar} from 'sentry/utils/queryString';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {useProfileGroup} from './profileGroupProvider';

function collectTopProfileFrames(profile: Profile) {
  const nodes: CallTreeNode[] = [];

  profile.forEach(
    node => {
      if (node.selfWeight > 0) {
        nodes.push(node);
      }
    },
    () => {}
  );

  return (
    nodes
      .sort((a, b) => b.selfWeight - a.selfWeight)
      // take only the slowest nodes from each thread because the rest
      // aren't useful to display
      .slice(0, 500)
      .map(node => ({
        symbol: node.frame.name,
        image: node.frame.image,
        thread: profile.threadId,
        type: node.frame.is_application ? 'application' : 'system',
        'self weight': node.selfWeight,
        'total weight': node.totalWeight,
      }))
  );
}

const RESULTS_PER_PAGE = 50;

function ProfileDetails() {
  const location = useLocation();
  const [state] = useProfileGroup();
  const organization = useOrganization();

  useEffect(() => {
    trackAdvancedAnalyticsEvent('profiling_views.profile_summary', {
      organization,
    });
  }, [organization]);

  const cursor = useMemo<number>(() => {
    const cursorQuery = decodeScalar(location.query.cursor, '');
    return parseInt(cursorQuery, 10) || 0;
  }, [location.query.cursor]);

  const query = useMemo<string>(() => decodeScalar(location.query.query, ''), [location]);

  const allFunctions: TableDataRow[] = useMemo(() => {
    return state.type === 'resolved'
      ? state.data.profiles
          .flatMap(collectTopProfileFrames)
          // Self weight desc sort
          .sort((a, b) => b['self weight'] - a['self weight'])
      : [];
  }, [state]);

  const searchIndex = useMemo(() => {
    return new Fuse(allFunctions, {
      keys: ['symbol'],
      threshold: 0.3,
    });
  }, [allFunctions]);

  const search = useCallback(
    (queryString: string) => {
      if (!queryString) {
        return allFunctions;
      }
      return searchIndex.search(queryString).map(result => result.item);
    },
    [searchIndex, allFunctions]
  );

  const [slowestFunctions, setSlowestFunctions] = useState<TableDataRow[]>(() => {
    return search(query);
  });

  useEffectAfterFirstRender(() => {
    setSlowestFunctions(search(query));
  }, [allFunctions, query, search]);

  const pageLinks = useMemo(() => {
    const prevResults = cursor >= RESULTS_PER_PAGE ? 'true' : 'false';
    const prevCursor = cursor >= RESULTS_PER_PAGE ? cursor - RESULTS_PER_PAGE : 0;
    const prevQuery = {...location.query, cursor: prevCursor};
    const prevHref = `${location.pathname}${qs.stringify(prevQuery)}`;
    const prev = `<${prevHref}>; rel="previous"; results="${prevResults}"; cursor="${prevCursor}"`;

    const nextResults =
      cursor + RESULTS_PER_PAGE < slowestFunctions.length ? 'true' : 'false';
    const nextCursor =
      cursor + RESULTS_PER_PAGE < slowestFunctions.length ? cursor + RESULTS_PER_PAGE : 0;
    const nextQuery = {...location.query, cursor: nextCursor};
    const nextHref = `${location.pathname}${qs.stringify(nextQuery)}`;
    const next = `<${nextHref}>; rel="next"; results="${nextResults}"; cursor="${nextCursor}"`;

    return `${prev},${next}`;
  }, [cursor, location, slowestFunctions]);

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

  const [filters, setFilters] = useState<Partial<Record<TableColumnKey, string[]>>>({});

  const columnFilters = useMemo(() => {
    function makeOnFilterChange(key: string) {
      return values => {
        setFilters(prevFilters => ({
          ...prevFilters,
          [key]: values.length > 0 ? values.map(val => val.value) : undefined,
        }));
      };
    }
    return {
      type: {
        values: ['application', 'system'],
        onChange: makeOnFilterChange('type'),
      },
      image: {
        values: pluckUniqueValues(slowestFunctions, 'image').sort((a, b) =>
          a.localeCompare(b)
        ),
        onChange: makeOnFilterChange('image'),
      },
    };
  }, [slowestFunctions]);

  const currentSort = useMemo<GridColumnSortBy<TableColumnKey>>(() => {
    let key = location.query?.functionsSort ?? '';

    const defaultSort = {
      key: 'self weight',
      order: 'desc',
    } as GridColumnSortBy<TableColumnKey>;

    const isDesc = key[0] === '-';
    if (isDesc) {
      key = key.slice(1);
    }

    if (!key || !tableColumnKey.includes(key as TableColumnKey)) {
      return defaultSort;
    }

    return {
      key,
      order: isDesc ? 'desc' : 'asc',
    } as GridColumnSortBy<TableColumnKey>;
  }, [location.query]);

  useEffect(() => {
    const removeListener = browserHistory.listenBefore((nextLocation, next) => {
      if (location.pathname === nextLocation.pathname) {
        next(nextLocation);
        return;
      }

      if ('functionsSort' in nextLocation.query) {
        delete nextLocation.query.functionsSort;
      }

      next(nextLocation);
    });

    return removeListener;
  });

  const generateSortLink = useCallback(
    (column: TableColumnKey) => {
      if (!SORTABLE_COLUMNS.has(column)) {
        return () => undefined;
      }
      if (!currentSort) {
        return () => ({
          ...location,
          query: {
            ...location.query,
            functionsSort: column,
          },
        });
      }

      const direction =
        currentSort.key !== column
          ? 'desc'
          : currentSort.order === 'desc'
          ? 'asc'
          : 'desc';

      return () => ({
        ...location,
        query: {
          ...location.query,
          functionsSort: `${direction === 'desc' ? '-' : ''}${column}`,
        },
      });
    },
    [location, currentSort]
  );

  const data = slowestFunctions
    .filter(row => {
      let include = true;
      for (const key in filters) {
        const values = filters[key];
        if (!values) {
          continue;
        }
        include = values.includes(row[key]);
        if (!include) {
          return false;
        }
      }
      return include;
    })
    .sort((a, b) => {
      if (currentSort.order === 'asc') {
        return a[currentSort.key] - b[currentSort.key];
      }
      return b[currentSort.key] - a[currentSort.key];
    })
    .slice(cursor, cursor + RESULTS_PER_PAGE);

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Profiling \u2014 Details')}
        orgSlug={organization.slug}
      >
        <Layout.Body>
          <Layout.Main fullWidth>
            <ActionBar>
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
              title={t('Slowest Functions')}
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
          </Layout.Main>
        </Layout.Body>
      </SentryDocumentTitle>
    </Fragment>
  );
}

function pluckUniqueValues<T extends Record<string, any>>(collection: T[], key: keyof T) {
  return collection.reduce((acc, val) => {
    if (!acc.includes(val[key])) {
      acc.push(val[key]);
    }
    return acc;
  }, [] as string[]);
}

const RIGHT_ALIGNED_COLUMNS = new Set<TableColumnKey>(['self weight', 'total weight']);
const SORTABLE_COLUMNS = new Set<TableColumnKey>(['self weight', 'total weight']);

const ActionBar = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto;
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

export default ProfileDetails;
