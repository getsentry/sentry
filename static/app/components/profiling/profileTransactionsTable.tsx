import {useMemo} from 'react';

import Count from 'sentry/components/count';
import DateTime from 'sentry/components/dateTime';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {ArrayLinks} from 'sentry/components/profiling/arrayLinks';
import {t} from 'sentry/locale';
import {ProfileTransaction} from 'sentry/types/profiling/core';
import {defined} from 'sentry/utils';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {generateProfileSummaryRouteWithQuery} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

interface ProfileTransactionsTableProps {
  error: string | null;
  isLoading: boolean;
  transactions: ProfileTransaction[];
}

function ProfileTransactionsTable(props: ProfileTransactionsTableProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();

  const transactions: TableDataRow[] = useMemo(() => {
    return props.transactions.map(transaction => {
      const project = projects.find(proj => proj.id === transaction.project_id);
      return {
        transaction: transaction.name,
        count: transaction.profiles_count,
        project,
        p50: transaction.duration_ms.p50,
        p75: transaction.duration_ms.p75,
        p90: transaction.duration_ms.p90,
        p95: transaction.duration_ms.p95,
        p99: transaction.duration_ms.p99,
        lastSeen: transaction.last_profile_at,
        versions: transaction.versions.map(version => {
          return {
            value: version,
            target: generateProfileSummaryRouteWithQuery({
              location,
              orgSlug: organization.slug,
              projectSlug: project?.slug ?? '',
              transaction: transaction.name,
              version,
            }),
          };
        }),
      };
    });
  }, [props.transactions, location, organization, projects]);

  return (
    <GridEditable
      isLoading={props.isLoading}
      error={props.error}
      data={transactions}
      columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
      columnSortBy={[]}
      grid={{
        renderHeadCell: renderTableHead,
        renderBodyCell: renderTableBody,
      }}
      location={location}
    />
  );
}

const RightAlignedColumns = new Set<TableColumnKey>([
  'count',
  'p50',
  'p75',
  'p90',
  'p95',
  'p99',
]);

function renderTableHead(column: TableColumn, _columnIndex: number) {
  return (
    <SortLink
      align={RightAlignedColumns.has(column.key) ? 'right' : 'left'}
      title={column.name}
      direction={undefined}
      canSort={false}
      generateSortLink={() => undefined}
    />
  );
}

function renderTableBody(
  column: TableColumn,
  dataRow: TableDataRow,
  rowIndex: number,
  columnIndex: number
) {
  return (
    <ProfilingTransactionsTableCell
      column={column}
      dataRow={dataRow}
      rowIndex={rowIndex}
      columnIndex={columnIndex}
    />
  );
}

interface ProfilingTransactionsTableCellProps {
  column: TableColumn;
  columnIndex: number;
  dataRow: TableDataRow;
  rowIndex: number;
}

function ProfilingTransactionsTableCell({
  column,
  dataRow,
}: ProfilingTransactionsTableCellProps) {
  const value = dataRow[column.key];

  switch (column.key) {
    case 'project':
      if (!defined(value)) {
        // should never happen but just in case
        return <Container>{t('n/a')}</Container>;
      }

      return (
        <Container>
          <ProjectBadge project={value} avatarSize={16} />
        </Container>
      );
    case 'count':
      return (
        <NumberContainer>
          <Count value={value} />
        </NumberContainer>
      );
    case 'p50':
    case 'p75':
    case 'p90':
    case 'p95':
    case 'p99':
      return (
        <NumberContainer>
          <PerformanceDuration milliseconds={value} abbreviation />
        </NumberContainer>
      );
    case 'lastSeen':
      return (
        <Container>
          <DateTime date={value} />
        </Container>
      );
    case 'versions':
      return <ArrayLinks items={value} />;
    default:
      return <Container>{value}</Container>;
  }
}

type TableColumnKey =
  | 'transaction'
  | 'count'
  | 'project'
  | 'p50'
  | 'p75'
  | 'p90'
  | 'p95'
  | 'p99'
  | 'versions'
  | 'lastSeen';

type TableDataRow = Record<TableColumnKey, any>;

type TableColumn = GridColumnOrder<TableColumnKey>;

const COLUMN_ORDER: TableColumnKey[] = [
  'transaction',
  'project',
  'versions',
  'lastSeen',
  'p75',
  'p95',
  'count',
];

const COLUMNS: Record<TableColumnKey, TableColumn> = {
  transaction: {
    key: 'transaction',
    name: t('Transaction'),
    width: COL_WIDTH_UNDEFINED,
  },
  count: {
    key: 'count',
    name: t('Count'),
    width: COL_WIDTH_UNDEFINED,
  },
  project: {
    key: 'project',
    name: t('Project'),
    width: COL_WIDTH_UNDEFINED,
  },
  p50: {
    key: 'p50',
    name: t('P50'),
    width: COL_WIDTH_UNDEFINED,
  },
  p75: {
    key: 'p75',
    name: t('P75'),
    width: COL_WIDTH_UNDEFINED,
  },
  p90: {
    key: 'p90',
    name: t('P90'),
    width: COL_WIDTH_UNDEFINED,
  },
  p95: {
    key: 'p95',
    name: t('P95'),
    width: COL_WIDTH_UNDEFINED,
  },
  p99: {
    key: 'p99',
    name: t('P99'),
    width: COL_WIDTH_UNDEFINED,
  },
  versions: {
    key: 'versions',
    name: t('Versions'),
    width: COL_WIDTH_UNDEFINED,
  },
  lastSeen: {
    key: 'lastSeen',
    name: t('Last Seen'),
    width: COL_WIDTH_UNDEFINED,
  },
};

export {ProfileTransactionsTable};
