import {ReactNode, ReactText, useMemo} from 'react';
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

type MetricsChartProps = {
  isLoading: boolean;
  location: Location;
  organization: Organization;
  transaction: NormalizedTrendsTransaction;
  trendFunction: string;
  trendView: TrendView;
};

export function MetricsChart(props: MetricsChartProps) {
  const {trendFunction, transaction, trendView, organization, location, isLoading} =
    props;
  let p50: TableDataRow[] = [];
  let p95: TableDataRow[] = [];
  let fieldsNeeded: AggregationKeyWithAlias[] = useMemo(() => ['tps'], []);

  if (trendFunction === TrendFunctionField.P50) {
    p50 = getTrendsRowData(transaction, TrendFunctionField.P50);
  }

  fieldsNeeded = useMemo(
    () =>
      trendFunction !== TrendFunctionField.P50
        ? [...fieldsNeeded, 'p50']
        : [...fieldsNeeded],
    [fieldsNeeded, trendFunction]
  );

  if (trendFunction === TrendFunctionField.P95) {
    p95 = getTrendsRowData(transaction, TrendFunctionField.P95);
  }

  fieldsNeeded = useMemo(
    () =>
      trendFunction !== TrendFunctionField.P95
        ? [...fieldsNeeded, 'p95']
        : [...fieldsNeeded],
    [fieldsNeeded, trendFunction]
  );

  const breakpoint = transaction.breakpoint;

  const hours = trendView.statsPeriod ? parsePeriodToHours(trendView.statsPeriod) : 0;
  const startTime = useMemo(() => moment().subtract(hours, 'h').toISOString(), [hours]);
  const breakpointTime = breakpoint ? new Date(breakpoint * 1000).toISOString() : '';
  const endTime = useMemo(() => moment().toISOString(), []);

  const beforeLocation = {
    ...location,
    start: startTime,
    end: breakpointTime,
    statsPeriod: undefined,
    dataset: DiscoverDatasets.METRICS,
    sort: undefined,
  };

  const afterLocation = {
    ...location,
    start: breakpointTime,
    end: endTime,
    statsPeriod: undefined,
    dataset: DiscoverDatasets.METRICS,
    sort: undefined,
  };

  const beforeErrorsLocation = {
    ...location,
    start: startTime,
    end: breakpointTime,
    statsPeriod: undefined,
    dataset: DiscoverDatasets.METRICS_ENHANCED,
    sort: undefined,
    query: {
      query: 'event.type:error transaction:' + transaction.transaction,
      statsPeriod: undefined,
      start: startTime,
      end: breakpointTime,
    },
  };

  const afterErrorsLocation = {
    ...location,
    start: breakpointTime,
    end: endTime,
    statsPeriod: undefined,
    dataset: DiscoverDatasets.METRICS_ENHANCED,
    sort: undefined,
    query: {
      query: 'event.type:error transaction:' + transaction.transaction,
      statsPeriod: undefined,
      start: breakpointTime,
      end: endTime,
    },
  };

  const beforeEventView = getEventViewWithFields(
    organization,
    trendView,
    startTime,
    breakpointTime,
    fieldsNeeded,
    'transaction',
    transaction.transaction,
    false
  );

  const afterEventView = getEventViewWithFields(
    organization,
    trendView,
    breakpointTime,
    endTime,
    fieldsNeeded,
    'transaction',
    transaction.transaction,
    false
  );

  const beforeErrorsEventView = getEventViewWithFields(
    organization,
    trendView,
    startTime,
    breakpointTime,
    ['count'],
    'error',
    transaction.transaction,
    true
  );

  const afterErrorsEventView = getEventViewWithFields(
    organization,
    trendView,
    breakpointTime,
    endTime,
    ['count'],
    'error',
    transaction.transaction,
    true
  );

  const {data: beforeBreakpoint, isLoading: isLoadingBefore} = useDiscoverQuery({
    eventView: beforeEventView,
    location: beforeLocation,
    orgSlug: organization.slug,
    transactionName: transaction.transaction,
    transactionThresholdMetric: TransactionThresholdMetric.TRANSACTION_DURATION,
    options: {
      refetchOnWindowFocus: false,
    },
  });

  const {data: afterBreakpoint, isLoading: isLoadingAfter} = useDiscoverQuery({
    eventView: afterEventView,
    location: afterLocation,
    orgSlug: organization.slug,
    transactionName: transaction.transaction,
    transactionThresholdMetric: TransactionThresholdMetric.TRANSACTION_DURATION,
    options: {
      refetchOnWindowFocus: false,
    },
  });

  const {data: beforeBreakpointErrors, isLoading: isLoadingBeforeErrors} =
    useDiscoverQuery({
      eventView: beforeErrorsEventView,
      location: beforeErrorsLocation,
      orgSlug: organization.slug,
      transactionName: transaction.transaction,
      transactionThresholdMetric: TransactionThresholdMetric.TRANSACTION_DURATION,
      options: {
        refetchOnWindowFocus: false,
      },
    });

  const {data: afterBreakpointErrors, isLoading: isLoadingAfterErrors} = useDiscoverQuery(
    {
      eventView: afterErrorsEventView,
      location: afterErrorsLocation,
      orgSlug: organization.slug,
      transactionName: transaction.transaction,
      transactionThresholdMetric: TransactionThresholdMetric.TRANSACTION_DURATION,
      options: {
        refetchOnWindowFocus: false,
      },
    }
  );

  const throughput: TableDataRow[] = getEventsRowData(
    'tps()',
    'Throughput',
    'ps',
    '-',
    false,
    beforeBreakpoint,
    afterBreakpoint
  );

  fieldsNeeded.includes('p50') &&
    (p50 = getEventsRowData(
      'p50()',
      'P50',
      'ms',
      '-',
      false,
      beforeBreakpoint,
      afterBreakpoint
    ));

  fieldsNeeded.includes('p95') &&
    (p95 = getEventsRowData(
      'p95()',
      'P95',
      'ms',
      '-',
      false,
      beforeBreakpoint,
      afterBreakpoint
    ));

  const errors: TableDataRow[] = getEventsRowData(
    'count()',
    'Errors',
    '',
    0,
    true,
    beforeBreakpointErrors,
    afterBreakpointErrors
  );

  const columnOrder = MetricColumnOrder.map(column => COLUMNS[column]);

  return (
    <GridEditable
      data={[...throughput, ...p50, ...p95, ...errors]}
      columnOrder={columnOrder}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
      location={location}
      isLoading={
        isLoadingBefore ||
        isLoadingAfter ||
        isLoading ||
        isLoadingBeforeErrors ||
        isLoadingAfterErrors
      }
    />
  );
}

function getEventsRowData(
  field: string,
  rowTitle: string,
  suffix: string,
  nullValue: string | number,
  wholeNumbers: boolean,
  beforeData?: TableData,
  afterData?: TableData
): TableDataRow[] {
  if (beforeData?.data[0][field] && afterData?.data[0][field]) {
    return [
      {
        metric: rowTitle,
        before: !wholeNumbers
          ? toFormattedNumber(beforeData.data[0][field], 1) + ' ' + suffix
          : beforeData.data[0][field],
        after: !wholeNumbers
          ? toFormattedNumber(afterData.data[0][field], 1) + ' ' + suffix
          : afterData.data[0][field],
        change: formatPercentage(
          percentChange(
            beforeData.data[0][field] as number,
            afterData.data[0][field] as number
          ),
          1
        ),
      },
    ];
  }
  return [
    {
      metric: rowTitle,
      before: nullValue,
      after: nullValue,
      change: '-',
    },
  ];
}

function getTrendsRowData(
  aggregateData: TrendsTransaction | undefined,
  metric: TrendFunctionField
): TableDataRow[] {
  if (aggregateData) {
    return [
      {
        metric: metric.toString().toUpperCase(),
        before: aggregateData?.aggregate_range_1.toFixed(1) + ' ms',
        after: aggregateData?.aggregate_range_2.toFixed(1) + ' ms',
        change:
          aggregateData?.trend_percentage !== 1
            ? formatPercentage(aggregateData?.trend_percentage! - 1, 1)
            : '-',
      },
    ];
  }
  return [];
}

function getEventViewWithFields(
  _organization: Organization,
  eventView: EventView,
  start: string,
  end: string,
  fields: AggregationKeyWithAlias[],
  eventType: string,
  transactionName: string,
  errors: boolean
): EventView {
  const newEventView = new EventView({
    ...eventView,
    start,
    end,
    statsPeriod: undefined,
    dataset: errors ? DiscoverDatasets.METRICS_ENHANCED : DiscoverDatasets.METRICS,
    query: 'event.type:' + eventType + ' transaction:' + transactionName,
    additionalConditions: new MutableSearch(''),
  });
  const chartFields: QueryFieldValue[] = fields.map(field => {
    return {
      kind: 'function',
      function: [field, '', undefined, undefined],
    };
  });

  return newEventView.withColumns(chartFields);
}

function toFormattedNumber(numberString: ReactText, decimal: number) {
  return (numberString as number).toFixed(decimal);
}

function percentChange(before: number, after: number) {
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
