import {Fragment, useCallback, useMemo, useState} from 'react';
import {browserHistory, Link} from 'react-router';
import styled from '@emotion/styled';
import Fuse from 'fuse.js';
import * as qs from 'query-string';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import {generateFlamegraphRouteWithQuery} from 'sentry/utils/profiling/routes';
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

function FlamegraphSummary() {
  const location = useLocation();
  const [state] = useProfileGroup();
  const organization = useOrganization();

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
      return searchIndex
        .search(queryString)
        .map(result => result.item)
        .sort((a, b) => b['self weight'] - a['self weight']);
    },
    [searchIndex, allFunctions]
  );

  const [slowestFunctions, setSlowestFunctions] = useState<TableDataRow[]>(() => {
    return search(query);
  });

  useEffectAfterFirstRender(() => {
    setSlowestFunctions(search(query));
  }, [allFunctions]);

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
      browserHistory.push({
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

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Profiling \u2014 Function')}
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
            </ActionBar>
            <GridEditable
              title={t('Slowest Functions')}
              isLoading={state.type === 'loading'}
              error={state.type === 'errored'}
              data={slowestFunctions.slice(cursor, cursor + RESULTS_PER_PAGE)}
              columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
              columnSortBy={[]}
              grid={{renderBodyCell: renderFunctionCell}}
              location={location}
            />
            <Pagination pageLinks={pageLinks} />
          </Layout.Main>
        </Layout.Body>
      </SentryDocumentTitle>
    </Fragment>
  );
}

const ActionBar = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: auto;
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
            to={generateFlamegraphRouteWithQuery({
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

type TableColumnKey =
  | 'symbol'
  | 'image'
  | 'self weight'
  | 'total weight'
  | 'thread'
  | 'type';
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
    name: t('Binary'),
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

export default FlamegraphSummary;
