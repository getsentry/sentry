import {useMemo, useState} from 'react';

import Count from 'sentry/components/count';
import DateTime from 'sentry/components/dateTime';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t} from 'sentry/locale';
import {ProfileTransaction} from 'sentry/types/profiling/core';
import {defined} from 'sentry/utils';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {generateProfileSummaryRouteWithQuery} from 'sentry/utils/profiling/routes';
import {renderTableHead} from 'sentry/utils/profiling/tableRenderer';
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
  const [currentSort, setCurrentSort] = useState<GridColumnSortBy<string> | null>(() => {
    if (location.query.orderBy) {
      const [key, order] = (location.query.orderBy as string).split(',');
      return {
        key,
        order,
      } as GridColumnSortBy<string>;
    }
    return null;
  });

  const sortableColumns = useMemo(
    () => new Set(['transaction', 'project', 'lastSeen', 'p75', 'p95', 'count']),
    []
  );

  const transactions: TableDataRow[] = useMemo(() => {
    const rows = props.transactions.map(transaction => {
      const project = projects.find(proj => proj.id === transaction.project_id);
      return {
        _transactionName: transaction.name,
        transaction: project ? (
          <Link
            to={generateProfileSummaryRouteWithQuery({
              query: location.query,
              orgSlug: organization.slug,
              projectSlug: project.slug,
              transaction: transaction.name,
            })}
          >
            {transaction.name}
          </Link>
        ) : (
          transaction.name
        ),
        count: transaction.profiles_count,
        project,
        p50: transaction.duration_ms.p50,
        p75: transaction.duration_ms.p75,
        p90: transaction.duration_ms.p90,
        p95: transaction.duration_ms.p95,
        p99: transaction.duration_ms.p99,
        lastSeen: transaction.last_profile_at,
      };
    });

    if (currentSort) {
      rows.sort((txA, txB) => {
        const column = currentSort.key;
        switch (column) {
          case 'transaction':
            return txA._transactionName.localeCompare(txB._transactionName);
          case 'lastSeen':
            return new Date(txA.lastSeen).getTime() - new Date(txB.lastSeen).getTime();
          case 'project':
            if (!txA.project?.slug || !txB.project?.slug) {
              return 1;
            }
            return txA.project.slug.localeCompare(txB.project.slug);
          case 'count':
            return txA.count - txB.count;
          case 'p75':
            return txA.p75 - txB.p75;
          case 'p95':
            return txA.p95 - txB.p95;
          default:
            return 1;
        }
      });

      if (currentSort.order === 'desc') {
        rows.reverse();
      }
    }

    return rows;
  }, [props.transactions, location, organization, projects, currentSort]);

  const generateSortLink = (column: string) => () => {
    let dir = 'asc';
    if (column === currentSort?.key && currentSort.order === 'asc') {
      dir = 'desc';
    }
    return {
      ...location,
      query: {
        ...location.query,
        orderBy: `${column},${dir}`,
      },
    };
  };

  const handleHeadCellOnClick = (column: GridColumnOrder<string>) => {
    if (currentSort?.key === column.key) {
      setCurrentSort({
        key: column.key,
        order: currentSort.order === 'asc' ? 'desc' : 'asc',
      });
      return;
    }
    setCurrentSort({
      key: column.key,
      order: 'asc',
    });
  };

  return (
    <GridEditable
      isLoading={props.isLoading}
      error={props.error}
      data={transactions}
      columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
      columnSortBy={currentSort ? [currentSort] : []}
      grid={{
        renderHeadCell: renderTableHead<string>({
          generateSortLink,
          onClick: handleHeadCellOnClick,
          sortableColumns,
          currentSort,
          rightAlignedColumns: RIGHT_ALIGNED_COLUMNS,
        }),
        renderBodyCell: renderTableBody,
      }}
      location={location}
    />
  );
}

const RIGHT_ALIGNED_COLUMNS = new Set<TableColumnKey>([
  'count',
  'p50',
  'p75',
  'p90',
  'p95',
  'p99',
]);

function renderTableBody(
  column: GridColumnOrder,
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
  column: GridColumnOrder;
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
  | 'lastSeen';

type TableDataRow = Record<TableColumnKey, any>;

type TableColumn = GridColumnOrder<TableColumnKey>;

const COLUMN_ORDER: TableColumnKey[] = [
  'transaction',
  'project',
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
  lastSeen: {
    key: 'lastSeen',
    name: t('Last Seen'),
    width: COL_WIDTH_UNDEFINED,
  },
};

export {ProfileTransactionsTable};
