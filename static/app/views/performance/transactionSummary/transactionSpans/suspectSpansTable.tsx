import {ReactNode} from 'react';
import {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {ColumnType, fieldAlignment} from 'sentry/utils/discover/fields';
import {Container as TableCellContainer} from 'sentry/utils/discover/styles';
import {SuspectSpans} from 'sentry/utils/performance/suspectSpans/types';

import {spanDetailsRouteWithQuery} from './spanDetails/utils';
import {SpanSort, SpanSortOthers, SpanSortPercentiles, SpansTotalValues} from './types';

type Props = {
  isLoading: boolean;
  location: Location;
  organization: Organization;
  sort: SpanSort;
  suspectSpans: SuspectSpans;
  totals: SpansTotalValues | null;
  transactionName: string;
  project?: Project;
};

export default function SuspectSpansTable(props: Props) {
  const {
    location,
    organization,
    transactionName,
    isLoading,
    suspectSpans,
    totals,
    sort,
    project,
  } = props;

  const data: TableDataRowWithExtras[] = suspectSpans.map(suspectSpan => ({
    operation: suspectSpan.op,
    group: suspectSpan.group,
    description: suspectSpan.description,
    totalCount: suspectSpan.count,
    frequency:
      // Frequency is computed using the `uniq` function in ClickHouse.
      // Because it is an approximation, it can occasionally exceed the number of events.
      defined(suspectSpan.frequency) && defined(totals?.count)
        ? Math.min(1, suspectSpan.frequency / totals!.count)
        : null,
    avgOccurrences: suspectSpan.avgOccurrences,
    p50ExclusiveTime: suspectSpan.p50ExclusiveTime,
    p75ExclusiveTime: suspectSpan.p75ExclusiveTime,
    p95ExclusiveTime: suspectSpan.p95ExclusiveTime,
    p99ExclusiveTime: suspectSpan.p99ExclusiveTime,
    sumExclusiveTime: suspectSpan.sumExclusiveTime,
  }));

  return (
    <GridEditable
      isLoading={isLoading}
      data={data}
      columnOrder={COLUMN_ORDER[sort].map(column => COLUMNS[column])}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell: renderBodyCellWithMeta(
          location,
          organization,
          transactionName,
          project
        ),
      }}
      location={location}
    />
  );
}

function renderHeadCell(column: TableColumn, _index: number): ReactNode {
  const align = fieldAlignment(column.key, COLUMN_TYPE[column.key]);
  return (
    <SortLink
      title={column.name}
      align={align}
      direction={undefined}
      canSort={false}
      generateSortLink={() => undefined}
    />
  );
}

function renderBodyCellWithMeta(
  location: Location,
  organization: Organization,
  transactionName: string,
  project?: Project
) {
  return (column: TableColumn, dataRow: TableDataRowWithExtras): React.ReactNode => {
    const fieldRenderer = getFieldRenderer(column.key, COLUMN_TYPE);

    if (column.key === 'description') {
      const target = spanDetailsRouteWithQuery({
        orgSlug: organization.slug,
        transaction: transactionName,
        query: location.query,
        spanSlug: {op: dataRow.operation, group: dataRow.group},
        projectID: project?.id,
      });
      return (
        <TableCellContainer>
          <Link to={target}>{dataRow[column.key] ?? t('(unnamed span)')}</Link>
        </TableCellContainer>
      );
    }

    return fieldRenderer(dataRow, {location, organization});
  };
}

type TableColumnKey =
  | 'operation'
  | 'description'
  | 'totalCount'
  | 'frequency'
  | 'avgOccurrences'
  | 'p50ExclusiveTime'
  | 'p75ExclusiveTime'
  | 'p95ExclusiveTime'
  | 'p99ExclusiveTime'
  | 'sumExclusiveTime';

type TableColumn = GridColumnOrder<TableColumnKey>;

type TableDataRow = Record<TableColumnKey, any>;

type TableDataRowWithExtras = TableDataRow & {
  group: string;
};

const COLUMN_ORDER: Record<SpanSort, TableColumnKey[]> = {
  [SpanSortOthers.COUNT]: [
    'operation',
    'description',
    'totalCount',
    'frequency',
    'p75ExclusiveTime',
    'sumExclusiveTime',
  ],
  [SpanSortOthers.AVG_OCCURRENCE]: [
    'operation',
    'description',
    'avgOccurrences',
    'frequency',
    'p75ExclusiveTime',
    'sumExclusiveTime',
  ],
  [SpanSortOthers.SUM_EXCLUSIVE_TIME]: [
    'operation',
    'description',
    'totalCount',
    'frequency',
    'p75ExclusiveTime',
    'sumExclusiveTime',
  ],
  [SpanSortPercentiles.P50_EXCLUSIVE_TIME]: [
    'operation',
    'description',
    'totalCount',
    'frequency',
    'p50ExclusiveTime',
    'sumExclusiveTime',
  ],
  [SpanSortPercentiles.P75_EXCLUSIVE_TIME]: [
    'operation',
    'description',
    'totalCount',
    'frequency',
    'p75ExclusiveTime',
    'sumExclusiveTime',
  ],
  [SpanSortPercentiles.P95_EXCLUSIVE_TIME]: [
    'operation',
    'description',
    'totalCount',
    'frequency',
    'p95ExclusiveTime',
    'sumExclusiveTime',
  ],
  [SpanSortPercentiles.P99_EXCLUSIVE_TIME]: [
    'operation',
    'description',
    'totalCount',
    'frequency',
    'p99ExclusiveTime',
    'sumExclusiveTime',
  ],
};

const COLUMNS: Record<TableColumnKey, TableColumn> = {
  operation: {
    key: 'operation',
    name: t('Span Operation'),
    width: COL_WIDTH_UNDEFINED,
  },
  description: {
    key: 'description',
    name: t('Span Name'),
    width: COL_WIDTH_UNDEFINED,
  },
  totalCount: {
    key: 'totalCount',
    name: t('Total Count'),
    width: COL_WIDTH_UNDEFINED,
  },
  frequency: {
    key: 'frequency',
    name: t('Frequency'),
    width: COL_WIDTH_UNDEFINED,
  },
  avgOccurrences: {
    key: 'avgOccurrences',
    name: t('Average Occurrences'),
    width: COL_WIDTH_UNDEFINED,
  },
  p50ExclusiveTime: {
    key: 'p50ExclusiveTime',
    name: t('P50 Self Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  p75ExclusiveTime: {
    key: 'p75ExclusiveTime',
    name: t('P75 Self Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  p95ExclusiveTime: {
    key: 'p95ExclusiveTime',
    name: t('P95 Self Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  p99ExclusiveTime: {
    key: 'p99ExclusiveTime',
    name: t('P99 Self Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  sumExclusiveTime: {
    key: 'sumExclusiveTime',
    name: t('Total Self Time'),
    width: COL_WIDTH_UNDEFINED,
  },
};

const COLUMN_TYPE: Record<TableColumnKey, ColumnType> = {
  operation: 'string',
  description: 'string',
  totalCount: 'integer',
  frequency: 'percentage',
  avgOccurrences: 'number',
  p50ExclusiveTime: 'duration',
  p75ExclusiveTime: 'duration',
  p95ExclusiveTime: 'duration',
  p99ExclusiveTime: 'duration',
  sumExclusiveTime: 'duration',
};
