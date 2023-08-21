import {ReactNode, useMemo} from 'react';
import {Location} from 'history';
import moment from 'moment';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {TableData, useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {
  AggregationKeyWithAlias,
  ColumnType,
  fieldAlignment,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {Container} from 'sentry/utils/discover/styles';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatPercentage} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {TransactionThresholdMetric} from 'sentry/views/performance/transactionSummary/transactionThresholdModal';
import {ExplorerText} from 'sentry/views/performance/trends/changeExplorer';
import {
  NormalizedTrendsTransaction,
  TrendFunctionField,
  TrendsTransaction,
  TrendView,
} from 'sentry/views/performance/trends/types';

type MetricsTableProps = {
  isLoading: boolean;
  location: Location;
  organization: Organization;
  transaction: NormalizedTrendsTransaction;
  trendFunction: string;
  trendView: TrendView;
};

const fieldsNeeded: AggregationKeyWithAlias[] = ['tps', 'p50', 'p95', 'failure_rate'];

type MetricColumnKey = 'metric' | 'before' | 'after' | 'change';

type MetricColumn = GridColumnOrder<MetricColumnKey>;

type TableDataRow = Record<MetricColumnKey, any>;

const MetricColumnOrder = ['metric', 'before', 'after', 'change'];

export const COLUMNS: Record<MetricColumnKey, MetricColumn> = {
  metric: {
    key: 'metric',
    name: t('Metric'),
    width: COL_WIDTH_UNDEFINED,
  },
  before: {
    key: 'before',
    name: t('Before'),
    width: COL_WIDTH_UNDEFINED,
  },
  after: {
    key: 'after',
    name: t('After'),
    width: COL_WIDTH_UNDEFINED,
  },
  change: {
    key: 'change',
    name: t('Change'),
    width: COL_WIDTH_UNDEFINED,
  },
};

const COLUMN_TYPE: Record<MetricColumnKey, ColumnType> = {
  metric: 'string',
  before: 'duration',
  after: 'duration',
  change: 'percentage',
};

export function MetricsTable(props: MetricsTableProps) {
  const {trendFunction, transaction, trendView, organization, location, isLoading} =
    props;
  const p50 =
    trendFunction === TrendFunctionField.P50
      ? getTrendsRowData(transaction, TrendFunctionField.P50)
      : undefined;
  const p95 =
    trendFunction === TrendFunctionField.P95
      ? getTrendsRowData(transaction, TrendFunctionField.P95)
      : undefined;

  const breakpoint = transaction.breakpoint;

  const hours = trendView.statsPeriod ? parsePeriodToHours(trendView.statsPeriod) : 0;
  const startTime = useMemo(
    () =>
      trendView.start ? trendView.start : moment().subtract(hours, 'h').toISOString(),
    [hours, trendView.start]
  );
  const breakpointTime = breakpoint ? new Date(breakpoint * 1000).toISOString() : '';
  const endTime = useMemo(
    () => (trendView.end ? trendView.end : moment().toISOString()),
    [trendView.end]
  );

  const {data: beforeBreakpoint, isLoading: isLoadingBefore} = useDiscoverQuery(
    getQueryParams(
      startTime,
      breakpointTime,
      fieldsNeeded,
      'transaction',
      DiscoverDatasets.METRICS,
      organization,
      trendView,
      transaction.transaction,
      location
    )
  );

  const {data: afterBreakpoint, isLoading: isLoadingAfter} = useDiscoverQuery(
    getQueryParams(
      breakpointTime,
      endTime,
      fieldsNeeded,
      'transaction',
      DiscoverDatasets.METRICS,
      organization,
      trendView,
      transaction.transaction,
      location
    )
  );

  const throughput: TableDataRow = getEventsRowData(
    'tps()',
    'Throughput',
    'ps',
    '-',
    false,
    beforeBreakpoint,
    afterBreakpoint
  );

  const p50Events = !p50
    ? getEventsRowData(
        'p50()',
        'P50',
        'ms',
        '-',
        false,
        beforeBreakpoint,
        afterBreakpoint
      )
    : p50;

  const p95Events = !p95
    ? getEventsRowData(
        'p95()',
        'P95',
        'ms',
        '-',
        false,
        beforeBreakpoint,
        afterBreakpoint
      )
    : p95;

  const failureRate: TableDataRow = getEventsRowData(
    'failure_rate()',
    'Failure Rate',
    '%',
    0,
    true,
    beforeBreakpoint,
    afterBreakpoint
  );

  const columnOrder = MetricColumnOrder.map(column => COLUMNS[column]);

  return (
    <GridEditable
      data={[throughput, p50Events, p95Events, failureRate]}
      columnOrder={columnOrder}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
      location={location}
      isLoading={isLoadingBefore || isLoadingAfter || isLoading}
    />
  );
}

function getEventsRowData(
  field: string,
  rowTitle: string,
  suffix: string,
  nullValue: string | number,
  percentage: boolean,
  beforeData?: TableData,
  afterData?: TableData
): TableDataRow {
  if (
    beforeData?.data[0][field] !== undefined &&
    afterData?.data[0][field] !== undefined
  ) {
    return {
      metric: rowTitle,
      before: !percentage
        ? toFormattedNumber(beforeData.data[0][field].toString(), 1) + ' ' + suffix
        : formatPercentage(beforeData.data[0][field] as number, 1),
      after: !percentage
        ? toFormattedNumber(afterData.data[0][field].toString(), 1) + ' ' + suffix
        : formatPercentage(afterData.data[0][field] as number, 1),
      change:
        beforeData.data[0][field] && afterData.data[0][field]
          ? formatPercentage(
              relativeChange(
                beforeData.data[0][field] as number,
                afterData.data[0][field] as number
              ),
              1
            )
          : '-',
    };
  }
  return {
    metric: rowTitle,
    before: nullValue,
    after: nullValue,
    change: '-',
  };
}

function getTrendsRowData(
  aggregateData: TrendsTransaction | undefined,
  metric: TrendFunctionField
): TableDataRow | undefined {
  if (aggregateData) {
    return {
      metric: metric.toString().toUpperCase(),
      before: aggregateData?.aggregate_range_1.toFixed(1) + ' ms',
      after: aggregateData?.aggregate_range_2.toFixed(1) + ' ms',
      change:
        aggregateData?.trend_percentage !== 1
          ? formatPercentage(aggregateData?.trend_percentage! - 1, 1)
          : '-',
    };
  }
  return undefined;
}

function getEventViewWithFields(
  _organization: Organization,
  eventView: EventView,
  start: string,
  end: string,
  fields: AggregationKeyWithAlias[],
  eventType: string,
  transactionName: string,
  dataset: DiscoverDatasets
): EventView {
  const newEventView = eventView.clone();
  newEventView.start = start;
  newEventView.end = end;
  newEventView.statsPeriod = undefined;
  newEventView.dataset = dataset;
  newEventView.query = 'event.type:' + eventType + ' transaction:' + transactionName;
  newEventView.additionalConditions = new MutableSearch('');

  const chartFields: QueryFieldValue[] = fields.map(field => {
    return {
      kind: 'function',
      function: [field, '', undefined, undefined],
    };
  });

  return newEventView.withColumns(chartFields);
}

function toFormattedNumber(numberString: string, decimal: number) {
  return parseFloat(numberString).toFixed(decimal);
}

export function relativeChange(before: number, after: number) {
  return (after - before) / before;
}

function renderHeadCell(column: MetricColumn, _index: number): ReactNode {
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

export function renderBodyCell(
  column: GridColumnOrder<MetricColumnKey>,
  dataRow: TableDataRow
) {
  let data = '';
  let color = '';
  if (column.key === 'change') {
    if (
      dataRow[column.key] === '0%' ||
      dataRow[column.key] === '+NaN%' ||
      dataRow[column.key] === '-'
    ) {
      data = '-';
    } else if (dataRow[column.key].charAt(0) !== '-') {
      color = theme.red300;
      data = '+' + dataRow[column.key];
    } else {
      color = theme.green300;
      data = dataRow[column.key];
    }
  } else {
    data = dataRow[column.key];
  }

  return (
    <Container data-test-id={'pce-metrics-chart-row-' + column.key}>
      <ExplorerText
        data-test-id={'pce-metrics-text-' + column.key}
        align={column.key !== 'metric' ? 'right' : 'left'}
        color={color}
      >
        {data}
      </ExplorerText>
    </Container>
  );
}

export function getQueryParams(
  startTime: string,
  endTime: string,
  fields: AggregationKeyWithAlias[],
  query: string,
  dataset: DiscoverDatasets,
  organization: Organization,
  eventView: EventView,
  transactionName: string,
  location: Location
) {
  const newLocation = {
    ...location,
    start: startTime,
    end: endTime,
    statsPeriod: undefined,
    dataset,
    sort: undefined,
    query: {
      query: `event.type: ${query} transaction: ${transactionName}`,
      statsPeriod: undefined,
      start: startTime,
      end: endTime,
    },
  };

  const newEventView = getEventViewWithFields(
    organization,
    eventView,
    startTime,
    endTime,
    fields,
    query,
    transactionName,
    dataset
  );

  return {
    eventView: newEventView,
    location: newLocation,
    orgSlug: organization.slug,
    transactionName,
    transactionThresholdMetric: TransactionThresholdMetric.TRANSACTION_DURATION,
    options: {
      refetchOnWindowFocus: false,
    },
  };
}
