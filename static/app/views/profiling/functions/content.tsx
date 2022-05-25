import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PerformanceDuration from 'sentry/components/performanceDuration';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {FunctionCall, VersionedFunctionCalls} from 'sentry/types/profiling/core';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {generateFlamegraphRouteWithQuery} from '../routes';

import {ArrayLinks} from './arrayLinks';

interface FunctionsContentProps {
  error: string | null;
  isLoading: boolean;
  project: Project;
  version: string;
  versionedFunctions: VersionedFunctionCalls | null;
}

function FunctionsContent(props: FunctionsContentProps) {
  const location = useLocation();
  const organization = useOrganization();
  const query = useMemo(
    () => decodeScalar(location.query.query, ''),
    [location.query.query]
  );

  const functions: TableDataRow[] = useMemo(() => {
    const functionCalls: FunctionCall[] =
      props.versionedFunctions?.Versions[props.version]?.FunctionCalls ?? [];

    return functionCalls.map(functionCall => {
      return {
        symbol: functionCall.symbol,
        image: functionCall.image,
        p50Duration: functionCall.duration_ns.p50,
        p75Duration: functionCall.duration_ns.p75,
        p90Duration: functionCall.duration_ns.p90,
        p95Duration: functionCall.duration_ns.p95,
        p99Duration: functionCall.duration_ns.p99,
        mainThreadPercent: functionCall.main_thread_percent,
        p50Frequency: functionCall.frequency.p50,
        p75Frequency: functionCall.frequency.p75,
        p90Frequency: functionCall.frequency.p90,
        p95Frequency: functionCall.frequency.p95,
        p99Frequency: functionCall.frequency.p99,
        profileIdToThreadId: Object.entries(functionCall.profile_id_to_thread_id).map(
          ([profileId, threadId]) => {
            return {
              value: getShortEventId(profileId),
              target: generateFlamegraphRouteWithQuery({
                orgSlug: organization.slug,
                projectSlug: props.project.slug,
                profileId,
                query: {tid: threadId.toString()},
              }),
            };
          }
        ),
      };
    });
  }, [organization.slug, props.project.slug, props.version, props.versionedFunctions]);

  const handleSearch: SmartSearchBarProps['onSearch'] = useCallback(
    (searchQuery: string) => {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchQuery || undefined,
        },
      });
    },
    [location]
  );

  return (
    <Layout.Main fullWidth>
      <ActionBar>
        <PageFilterBar condensed>
          <EnvironmentPageFilter />
          <DatePageFilter alignDropdown="left" />
        </PageFilterBar>
        <SmartSearchBar
          organization={organization}
          hasRecentSearches
          searchSource="profile_landing"
          supportedTags={{}}
          query={query}
          onSearch={handleSearch}
          maxQueryLength={MAX_QUERY_LENGTH}
        />
      </ActionBar>
      <GridEditable
        isLoading={props.isLoading}
        error={props.error}
        data={functions}
        columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
        columnSortBy={[]}
        grid={{renderBodyCell: renderProfilingTableCell}}
        location={location}
      />
    </Layout.Main>
  );
}

function renderProfilingTableCell(
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

function ProfilingFunctionsTableCell({
  column,
  dataRow,
}: ProfilingFunctionsTableCellProps) {
  const value = dataRow[column.key];

  switch (column.key) {
    case 'p50Frequency':
    case 'p75Frequency':
    case 'p90Frequency':
    case 'p95Frequency':
    case 'p99Frequency':
      return (
        <NumberContainer>
          <Count value={value} />
        </NumberContainer>
      );
    case 'p50Duration':
    case 'p75Duration':
    case 'p90Duration':
    case 'p95Duration':
    case 'p99Duration':
      return (
        <NumberContainer>
          <PerformanceDuration nanoseconds={value} abbreviation />
        </NumberContainer>
      );
    case 'profileIdToThreadId':
      return <ArrayLinks items={value} />;
    default:
      return <Container>{value}</Container>;
  }
}

type TableColumnKey =
  | 'symbol'
  | 'image'
  | 'p50Duration'
  | 'p75Duration'
  | 'p90Duration'
  | 'p95Duration'
  | 'p99Duration'
  | 'mainThreadPercent'
  | 'p50Frequency'
  | 'p75Frequency'
  | 'p90Frequency'
  | 'p95Frequency'
  | 'p99Frequency'
  | 'profileIdToThreadId';

type TableDataRow = Record<TableColumnKey, any>;

type TableColumn = GridColumnOrder<TableColumnKey>;

const COLUMN_ORDER: TableColumnKey[] = [
  'symbol',
  'image',
  'p75Duration',
  'p99Duration',
  'mainThreadPercent',
  'p75Frequency',
  'p99Frequency',
  'profileIdToThreadId',
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
  p50Duration: {
    key: 'p50Duration',
    name: t('P50 Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  p75Duration: {
    key: 'p75Duration',
    name: t('P75 Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  p90Duration: {
    key: 'p90Duration',
    name: t('P90 Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  p95Duration: {
    key: 'p95Duration',
    name: t('P95 Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  p99Duration: {
    key: 'p99Duration',
    name: t('P99 Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  mainThreadPercent: {
    key: 'mainThreadPercent',
    name: t('Main Thread %'),
    width: COL_WIDTH_UNDEFINED,
  },
  p50Frequency: {
    key: 'p50Frequency',
    name: t('P50 Frequency'),
    width: COL_WIDTH_UNDEFINED,
  },
  p75Frequency: {
    key: 'p75Frequency',
    name: t('P75 Frequency'),
    width: COL_WIDTH_UNDEFINED,
  },
  p90Frequency: {
    key: 'p90Frequency',
    name: t('P90 Frequency'),
    width: COL_WIDTH_UNDEFINED,
  },
  p95Frequency: {
    key: 'p95Frequency',
    name: t('P95 Frequency'),
    width: COL_WIDTH_UNDEFINED,
  },
  p99Frequency: {
    key: 'p99Frequency',
    name: t('P99 Frequency'),
    width: COL_WIDTH_UNDEFINED,
  },
  profileIdToThreadId: {
    key: 'profileIdToThreadId',
    name: t('Example Profiles'),
    width: COL_WIDTH_UNDEFINED,
  },
};

const ActionBar = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: min-content auto;
  margin-bottom: ${space(2)};
`;

export {FunctionsContent};
