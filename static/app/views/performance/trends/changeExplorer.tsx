import React, {ReactNode, ReactText, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {Button} from 'sentry/components/button';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {IconFire} from 'sentry/icons';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
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
import useKeyPress from 'sentry/utils/useKeyPress';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import {TransactionThresholdMetric} from 'sentry/views/performance/transactionSummary/transactionThresholdModal';
import {Chart} from 'sentry/views/performance/trends/chart';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendFunctionField,
  TrendParameter,
  TrendsStats,
  TrendsTransaction,
  TrendView,
} from 'sentry/views/performance/trends/types';
import SlideOverPanel from 'sentry/views/starfish/components/slideOverPanel';

type PerformanceChangeExplorerProps = {
  collapsed: boolean;
  isLoading: boolean;
  location: Location;
  onClose: () => void;
  organization: Organization;
  projects: Project[];
  statsData: TrendsStats;
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
  trendFunction: string;
  trendParameter: TrendParameter;
  trendView: TrendView;
};

type ExplorerBodyProps = {
  isLoading: boolean;
  location: Location;
  organization: Organization;
  projects: Project[];
  statsData: TrendsStats;
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
  trendFunction: string;
  trendParameter: TrendParameter;
  trendView: TrendView;
};

type HeaderProps = {
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
};

type MetricsChartProps = {
  isLoading: boolean;
  location: Location;
  organization: Organization;
  transaction: NormalizedTrendsTransaction;
  trendFunction: string;
  trendView: TrendView;
};

export function PerformanceChangeExplorer({
  collapsed,
  transaction,
  onClose,
  trendChangeType,
  trendFunction,
  trendView,
  statsData,
  isLoading,
  organization,
  projects,
  trendParameter,
  location,
}: PerformanceChangeExplorerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(panelRef, () => {
    if (!collapsed) {
      onClose();
    }
  });

  const escapeKeyPressed = useKeyPress('Escape');

  useEffect(() => {
    if (escapeKeyPressed) {
      if (!collapsed) {
        onClose();
      }
    }
  }, [escapeKeyPressed, collapsed, onClose]);

  return (
    <SlideOverPanel collapsed={collapsed} ref={panelRef}>
      <CloseButtonWrapper>
        <CloseButton
          priority="link"
          size="zero"
          borderless
          aria-label={t('Close Details')}
          icon={<IconClose size="sm" />}
          onClick={onClose}
        />
      </CloseButtonWrapper>
      <PanelBodyWrapper>
        <ExplorerBody
          transaction={transaction}
          trendChangeType={trendChangeType}
          trendFunction={trendFunction}
          trendView={trendView}
          statsData={statsData}
          isLoading={isLoading}
          organization={organization}
          projects={projects}
          trendParameter={trendParameter}
          location={location}
        />
      </PanelBodyWrapper>
    </SlideOverPanel>
  );
}

function ExplorerBody(props: ExplorerBodyProps) {
  const {
    transaction,
    trendChangeType,
    trendFunction,
    trendView,
    trendParameter,
    isLoading,
    location,
    organization,
  } = props;
  const breakpointDate = new Date(transaction.breakpoint! * 1000)
    .toUTCString()
    .replace('GMT', 'UTC');
  return (
    <React.Fragment>
      <Header transaction={transaction} trendChangeType={trendChangeType} />
      <Div>
        <Div flex>
          <InfoItem
            float
            margin
            label={
              trendChangeType === TrendChangeType.REGRESSION
                ? t('Regression Metric')
                : t('Improvement Metric')
            }
            value={trendFunction}
          />
          <InfoItem label={t('Start Time')} value={breakpointDate} />
        </Div>
      </Div>
      <GraphPanel data-test-id="pce-graph">
        <strong>{trendParameter.label + ' (' + trendFunction + ')'}</strong>
        <P color={theme.gray300} margin={'-' + space(3)}>
          {trendView.statsPeriod
            ? DEFAULT_RELATIVE_PERIODS[trendView.statsPeriod] ||
              getTimeString(trendView.statsPeriod)
            : trendView.start + ' - ' + trendView.end}
        </P>
        <Chart
          query={trendView.query}
          project={trendView.project}
          environment={trendView.environment}
          start={trendView.start}
          end={trendView.end}
          statsPeriod={trendView.statsPeriod}
          disableXAxis
          disableLegend
          neutralColor
          {...props}
        />
      </GraphPanel>
      <MetricsChart
        isLoading={isLoading}
        location={location}
        transaction={transaction}
        trendFunction={trendFunction}
        trendView={trendView}
        organization={organization}
      />
    </React.Fragment>
  );
}

function getTimeString(time: string) {
  const timeMeasurements = {
    m: 'minutes',
    h: 'hours',
    d: 'days',
    w: 'weeks',
  };

  const suffix = time.charAt(time.length - 1);
  const number = time.slice(0, time.length - 1);
  const measurement =
    number === '1'
      ? timeMeasurements[suffix].slice(0, timeMeasurements[suffix].length - 1)
      : timeMeasurements[suffix];

  const timestring = number === '1' ? measurement : number + ' ' + measurement;
  return tct('Last [timestring]', {timestring});
}

function InfoItem({
  label,
  value,
  margin,
  float,
}: {
  label: string;
  value: string;
  float?: boolean;
  margin?: boolean;
}) {
  return (
    <Div margin={margin} float={float}>
      <Strong>{label}</Strong>
      <LargeText>{value}</LargeText>
    </Div>
  );
}

function Header(props: HeaderProps) {
  const {transaction, trendChangeType} = props;

  const regression = trendChangeType === TrendChangeType.REGRESSION;

  return (
    <HeaderWrapper data-test-id="pce-header">
      <FireIcon regression={regression} />
      <HeaderTextWrapper>
        <ChangeType regression={regression}>
          {regression ? t('Ongoing Regression') : t('Ongoing Improvement')}
        </ChangeType>
        <TransactionName>{transaction.transaction}</TransactionName>
      </HeaderTextWrapper>
    </HeaderWrapper>
  );
}

function getRowData(
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

export function MetricsChart(props: MetricsChartProps) {
  const {trendFunction, transaction, trendView, organization, location, isLoading} =
    props;
  let p50: TableDataRow[] = [];
  let p95: TableDataRow[] = [];
  let fieldsNeeded: AggregationKeyWithAlias[] = ['tps'];

  if (trendFunction === TrendFunctionField.P50) {
    p50 = getRowData(transaction, TrendFunctionField.P50);
  } else {
    fieldsNeeded = [...fieldsNeeded, 'p50'];
  }

  if (trendFunction === TrendFunctionField.P95) {
    p95 = getRowData(transaction, TrendFunctionField.P95);
  } else {
    fieldsNeeded = [...fieldsNeeded, 'p95'];
  }

  const breakpoint = transaction.breakpoint!;

  const hours = trendView.statsPeriod ? parsePeriodToHours(trendView.statsPeriod) : 0;
  const startTime = moment().subtract(hours, 'h').toISOString();
  const breakpointTime = new Date(breakpoint * 1000).toISOString();
  const endTime = moment().toISOString();

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

  // in a hook because trendView causes constant re-rendering
  const beforeEventView = useMemo(
    () =>
      getEventViewWithFields(
        organization,
        trendView,
        startTime,
        breakpointTime,
        fieldsNeeded,
        'transaction',
        transaction.transaction,
        false
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const afterEventView = useMemo(
    () =>
      getEventViewWithFields(
        organization,
        trendView,
        breakpointTime,
        endTime,
        fieldsNeeded,
        'transaction',
        transaction.transaction,
        false
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const beforeErrorsEventView = useMemo(
    () =>
      getEventViewWithFields(
        organization,
        trendView,
        startTime,
        breakpointTime,
        ['count'],
        'error',
        transaction.transaction,
        true
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const afterErrorsEventView = useMemo(
    () =>
      getEventViewWithFields(
        organization,
        trendView,
        breakpointTime,
        endTime,
        ['count'],
        'error',
        transaction.transaction,
        true
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
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

  const throughput: TableDataRow[] =
    beforeBreakpoint?.data[0]['tps()'] && afterBreakpoint?.data[0]['tps()']
      ? [
          {
            metric: t('Throughput'),
            before: toFormattedNumber(beforeBreakpoint.data[0]['tps()'], 1) + ' ps',
            after: toFormattedNumber(afterBreakpoint.data[0]['tps()'], 1) + ' ps',
            change: formatPercentage(
              percentChange(
                beforeBreakpoint.data[0]['tps()'] as number,
                afterBreakpoint.data[0]['tps()'] as number
              ),
              1
            ),
          },
        ]
      : [
          {
            metric: t('Throughput'),
            before: '-',
            after: '-',
            change: '-',
          },
        ];

  fieldsNeeded.includes('p50') &&
    (beforeBreakpoint?.data[0]['p50()'] && afterBreakpoint?.data[0]['p50()']
      ? (p50 = [
          {
            metric: 'P50',
            before: toFormattedNumber(beforeBreakpoint.data[0]['p50()'], 1) + ' ms',
            after: toFormattedNumber(afterBreakpoint.data[0]['p50()'], 1) + ' ms',
            change: formatPercentage(
              percentChange(
                beforeBreakpoint.data[0]['p50()'] as number,
                afterBreakpoint.data[0]['p50()'] as number
              ),
              1
            ),
          },
        ])
      : (p50 = [
          {
            metric: 'P50',
            before: '-',
            after: '-',
            change: '-',
          },
        ]));

  fieldsNeeded.includes('p95') &&
    (beforeBreakpoint?.data[0]['p95()'] && afterBreakpoint?.data[0]['p95()']
      ? (p95 = [
          {
            metric: 'P95',
            before: toFormattedNumber(beforeBreakpoint.data[0]['p95()'], 1) + ' ms',
            after: toFormattedNumber(afterBreakpoint.data[0]['p95()'], 1) + ' ms',
            change: formatPercentage(
              percentChange(
                beforeBreakpoint.data[0]['p95()'] as number,
                afterBreakpoint.data[0]['p95()'] as number
              ),
              1
            ),
          },
        ])
      : (p95 = [
          {
            metric: 'P95',
            before: '-',
            after: '-',
            change: '-',
          },
        ]));

  const errors: TableDataRow[] =
    beforeBreakpointErrors?.data[0]['count()'] &&
    afterBreakpointErrors?.data[0]['count()']
      ? [
          {
            metric: t('Errors'),
            before: beforeBreakpointErrors.data[0]['count()'],
            after: afterBreakpointErrors.data[0]['count()'],
            change: formatPercentage(
              percentChange(
                beforeBreakpointErrors.data[0]['count()'] as number,
                afterBreakpointErrors.data[0]['count()'] as number
              ),
              1
            ),
          },
        ]
      : [
          {
            metric: t('Errors'),
            before: 0,
            after: 0,
            change: '-',
          },
        ];

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

function FireIcon({regression}: {regression: boolean}) {
  return (
    <IconWrapper regression={regression}>
      <IconFire color="white" />
    </IconWrapper>
  );
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
      <P
        data-test-id={'pce-metrics-text-' + column.key}
        align={column.key !== 'metric' ? 'right' : 'left'}
        color={color}
      >
        {data}
      </P>
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

const CloseButton = styled(Button)`
  color: ${p => p.theme.gray300};
  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

const CloseButtonWrapper = styled('div')`
  justify-content: flex-end;
  display: flex;
  padding: ${space(2)};
`;

const PanelBodyWrapper = styled('div')`
  padding: 0 ${space(4)};
  margin-top: ${space(4)};
`;

const HeaderWrapper = styled('div')`
  display: flex;
  flex-wrap: nowrap;
  margin-bottom: ${space(3)};
`;
const HeaderTextWrapper = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;
type ChangeTypeProps = {regression: boolean};

const ChangeType = styled('p')<ChangeTypeProps>`
  color: ${p => (p.regression ? p.theme.danger : p.theme.success)};
  margin-bottom: ${space(0)};
`;

const IconWrapper = styled('div')<ChangeTypeProps>`
  padding: ${space(1.5)};
  background-color: ${p => (p.regression ? p.theme.danger : p.theme.success)};
  border-radius: ${space(0.5)};
  margin-right: ${space(2)};
  float: left;
  height: 40px;
`;

const TransactionName = styled('h4')`
  margin-right: ${space(1)};
  ${p => p.theme.overflowEllipsis};
`;
const Strong = styled('strong')`
  color: ${p => p.theme.gray300};
`;
const LargeText = styled('h3')`
  font-weight: normal;
`;
const GraphPanel = styled('div')`
  border: 1px ${p => 'solid ' + p.theme.border};
  border-radius: ${p => p.theme.panelBorderRadius};
  margin-bottom: ${space(2)};
  padding: ${space(3)};
  display: block;
`;

type DivProps = {
  flex?: boolean;
  float?: boolean;
  margin?: boolean;
};

const Div = styled('div')<DivProps>`
  display: ${p => (p.flex ? 'flex' : 'block')};
  float: ${p => (p.float ? 'left' : 'none')};
  margin-right: ${p => (p.margin ? space(4) : space(0))};
`;
type TextProps = {
  align?: string;
  color?: string;
  margin?: string;
};

const P = styled('p')<TextProps>`
  margin-bottom: ${p => (p.margin ? p.margin : space(0))};
  color: ${p => p.color};
  text-align: ${p => p.align};
`;
