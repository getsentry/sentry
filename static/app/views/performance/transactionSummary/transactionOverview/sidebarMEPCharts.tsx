import {Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {InjectedRouter, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'sentry/api';
import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import {LineChart, LineChartProps} from 'sentry/components/charts/lineChart';
import {SectionHeading} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {
  MetricsCardinalityContext,
  useMetricsCardinalityContext,
} from 'sentry/utils/performance/contexts/metricsCardinality';
import {Theme} from 'sentry/utils/theme';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {getTermHelp, PERFORMANCE_TERM} from 'sentry/views/performance/data';

import {getMetricOnlyQueryParams} from '../../landing/widgets/utils';

type ContainerProps = WithRouterProps & {
  error: QueryError | null;
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  organization: Organization;
  totals: Record<string, number> | null;
  transactionName: string;
  isShowingMetricsEventCount?: boolean;
};

interface ChartData {
  chartOptions: Omit<LineChartProps, 'series'>;
  errored: boolean;
  loading: boolean;
  reloading: boolean;
  series: LineChartProps['series'];
}

type Props = Pick<ContainerProps, 'organization' | 'isLoading' | 'error' | 'totals'> & {
  chartData: ChartData;
  eventView: EventView;
  location: Location;
  router: InjectedRouter;
  transactionName: string;
  utc: boolean;
  end?: Date;
  isShowingMetricsEventCount?: boolean;
  isUsingMEP?: boolean;
  metricsChartData?: ChartData;
  start?: Date;
  statsPeriod?: string | null;
};

function SidebarCharts(props: Props) {
  const {isShowingMetricsEventCount, start, end, utc, router, statsPeriod, chartData} =
    props;
  const placeholderHeight = isShowingMetricsEventCount ? '200px' : '300px';
  const boxHeight = isShowingMetricsEventCount ? '300px' : '400px';
  return (
    <RelativeBox>
      <ChartLabels {...props} />
      <ChartZoom
        router={router}
        period={statsPeriod}
        start={start}
        end={end}
        utc={utc}
        xAxisIndex={[0, 1, 2]}
      >
        {zoomRenderProps => {
          const {errored, loading, reloading, chartOptions, series} = chartData;

          if (errored) {
            return (
              <ErrorPanel height={boxHeight}>
                <IconWarning color="gray300" size="lg" />
              </ErrorPanel>
            );
          }

          return (
            <TransitionChart loading={loading} reloading={reloading} height={boxHeight}>
              <TransparentLoadingMask visible={reloading} />
              {getDynamicText({
                value: (
                  <LineChart {...zoomRenderProps} {...chartOptions} series={series} />
                ),
                fixed: <Placeholder height={placeholderHeight} testId="skeleton-ui" />,
              })}
            </TransitionChart>
          );
        }}
      </ChartZoom>
    </RelativeBox>
  );
}

function getDatasetCounts({
  chartData,
  metricsChartData,
  metricsCardinality,
}: {
  metricsCardinality: MetricsCardinalityContext;
  chartData?: ChartData;
  metricsChartData?: ChartData;
}) {
  const transactionCount =
    chartData?.series[0]?.data.reduce((sum, {value}) => sum + value, 0) ?? 0;
  const metricsCount =
    metricsChartData?.series[0]?.data.reduce((sum, {value}) => sum + value, 0) ?? 0;
  const missingMetrics =
    (!metricsCount && transactionCount) ||
    metricsCount < transactionCount ||
    metricsCardinality.outcome?.forceTransactionsOnly;
  return {
    transactionCount,
    metricsCount,
    missingMetrics,
  };
}

function ChartLabels({
  organization,
  isLoading,
  totals,
  error,
  isShowingMetricsEventCount,
  chartData,
  metricsChartData,
}: Props) {
  const useAggregateAlias = !organization.features.includes(
    'performance-frontend-use-events-endpoint'
  );
  const metricsCardinality = useMetricsCardinalityContext();

  if (isShowingMetricsEventCount) {
    const {transactionCount, metricsCount, missingMetrics} = getDatasetCounts({
      chartData,
      metricsChartData,
      metricsCardinality,
    });

    return (
      <Fragment>
        <ChartLabel top="0px">
          <ChartTitle>
            {t('Count')}
            <QuestionTooltip
              position="top"
              title={t(
                'The count of events for the selected time period, showing the indexed events powering this page with filters compared to total processed events.'
              )}
              size="sm"
            />
          </ChartTitle>
          <ChartSummaryValue
            data-test-id="tpm-summary-value"
            isLoading={isLoading}
            error={error}
            value={
              totals
                ? missingMetrics
                  ? tct('[txnCount]', {
                      txnCount: formatAbbreviatedNumber(transactionCount),
                    })
                  : tct('[txnCount] of [metricCount]', {
                      txnCount: formatAbbreviatedNumber(transactionCount),
                      metricCount: formatAbbreviatedNumber(metricsCount),
                    })
                : null
            }
          />
        </ChartLabel>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <ChartLabel top="0px">
        <ChartTitle>
          {t('Apdex')}
          <QuestionTooltip
            position="top"
            title={getTermHelp(organization, PERFORMANCE_TERM.APDEX)}
            size="sm"
          />
        </ChartTitle>
        <ChartSummaryValue
          data-test-id="apdex-summary-value"
          isLoading={isLoading}
          error={error}
          value={
            totals
              ? // @ts-expect-error TS(2345) FIXME: Argument of type 'number | undefined' is not assig... Remove this comment to see the full error message
                formatFloat(useAggregateAlias ? totals.apdex : totals['apdex()'], 4)
              : null
          }
        />
      </ChartLabel>

      <ChartLabel top="160px">
        <ChartTitle>
          {t('Failure Rate')}
          <QuestionTooltip
            position="top"
            title={getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE)}
            size="sm"
          />
        </ChartTitle>
        <ChartSummaryValue
          data-test-id="failure-rate-summary-value"
          isLoading={isLoading}
          error={error}
          value={
            totals
              ? formatPercentage(
                  // @ts-expect-error TS(2345) FIXME: Argument of type 'number | undefined' is not assig... Remove this comment to see the full error message
                  useAggregateAlias ? totals.failure_rate : totals['failure_rate()']
                )
              : null
          }
        />
      </ChartLabel>
    </Fragment>
  );
}

function getSideChartsOptions({
  theme,
  utc,
  isShowingMetricsEventCount,
}: {
  theme: Theme;
  utc: boolean;
  isShowingMetricsEventCount?: boolean;
}) {
  const colors = theme.charts.getColorPalette(3);

  const axisLineConfig = {
    scale: true,
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    splitLine: {
      show: false,
    },
  };

  if (isShowingMetricsEventCount) {
    const chartOptions: Omit<LineChartProps, 'series'> = {
      height: 200,
      grid: [
        {
          top: '60px',
          left: '10px',
          right: '10px',
          height: '160px',
        },
      ],
      axisPointer: {
        // Link each x-axis together.
        link: [{xAxisIndex: [0]}],
      },
      xAxes: Array.from(new Array(1)).map((_i, index) => ({
        gridIndex: index,
        type: 'time',
        show: false,
      })),
      yAxes: [
        {
          // throughput
          gridIndex: 0,
          splitNumber: 4,
          axisLabel: {
            formatter: formatAbbreviatedNumber,
            color: theme.chartLabel,
          },
          ...axisLineConfig,
        },
        {
          // throughput
          gridIndex: 0,
          splitNumber: 4,
          axisLabel: {
            formatter: formatAbbreviatedNumber,
            color: theme.chartLabel,
          },
          ...axisLineConfig,
        },
      ],
      utc,
      isGroupedByDate: true,
      showTimeInTooltip: true,
      // @ts-expect-error TS(2322) FIXME: Type 'string | undefined' is not assignable to typ... Remove this comment to see the full error message
      colors: [colors[0], theme.gray300],
      tooltip: {
        trigger: 'axis',
        truncate: 80,
        valueFormatter: (value, label) =>
          tooltipFormatter(value, aggregateOutputType(label)),
        nameFormatter(value: string) {
          return value === 'epm()' ? 'tpm()' : value;
        },
      },
    };
    return chartOptions;
  }

  const chartOptions: Omit<LineChartProps, 'series'> = {
    height: 300,
    grid: [
      {
        top: '60px',
        left: '10px',
        right: '10px',
        height: '100px',
      },
      {
        top: '220px',
        left: '10px',
        right: '10px',
        height: '100px',
      },
    ],
    axisPointer: {
      // Link each x-axis together.
      link: [{xAxisIndex: [0, 1]}],
    },
    xAxes: Array.from(new Array(2)).map((_i, index) => ({
      gridIndex: index,
      type: 'time',
      show: false,
    })),
    yAxes: [
      {
        // apdex
        gridIndex: 0,
        interval: 0.2,
        axisLabel: {
          formatter: (value: number) => `${formatFloat(value, 1)}`,
          color: theme.chartLabel,
        },
        ...axisLineConfig,
      },
      {
        // failure rate
        gridIndex: 1,
        splitNumber: 4,
        interval: 0.5,
        max: 1.0,
        axisLabel: {
          formatter: (value: number) => formatPercentage(value, 0),
          color: theme.chartLabel,
        },
        ...axisLineConfig,
      },
    ],
    utc,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    // @ts-expect-error TS(2322) FIXME: Type 'string | undefined' is not assignable to typ... Remove this comment to see the full error message
    colors: [colors[1], colors[2]],
    tooltip: {
      trigger: 'axis',
      truncate: 80,
      valueFormatter: (value, label) =>
        tooltipFormatter(value, aggregateOutputType(label)),
      nameFormatter(value: string) {
        return value === 'epm()' ? 'tpm()' : value;
      },
    },
  };
  return chartOptions;
}

/**
 * Temporary function to remove 0 values from beginning and end of the metrics time series.
 * TODO(): Fix the data coming back from the api so it's consistent with existing count data.
 */
function trimLeadingTrailingZeroCounts(series: Series | undefined) {
  if (!series?.data) {
    return undefined;
  }

  if (series.data[0] && series.data[0].value === 0) {
    series.data.shift();
  }

  if (
    series.data[series.data.length - 1] &&
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    series.data[series.data.length - 1].value === 0
  ) {
    series.data.pop();
  }

  return series;
}

const ALLOWED_QUERY_KEYS = ['transaction.op', 'transaction'];

function SidebarChartsContainer({
  location,
  eventView,
  organization,
  router,
  isLoading,
  error,
  totals,
  transactionName,
  isShowingMetricsEventCount,
}: ContainerProps) {
  const api = useApi();
  const theme = useTheme();
  const metricsCardinality = useMetricsCardinalityContext();

  const statsPeriod = eventView.statsPeriod;
  const start = eventView.start ? getUtcToLocalDateObject(eventView.start) : undefined;
  const end = eventView.end ? getUtcToLocalDateObject(eventView.end) : undefined;
  const project = eventView.project;
  const environment = eventView.environment;
  const query = eventView.query;
  const utc = normalizeDateTimeParams(location.query).utc === 'true';

  const chartOptions = getSideChartsOptions({
    theme,
    utc,
    isShowingMetricsEventCount,
  });

  const requestCommonProps = {
    api,
    start,
    end,
    period: statsPeriod,
    project,
    environment,
    query,
  };

  const contentCommonProps = {
    organization,
    router,
    error,
    isLoading,
    start,
    end,
    utc,
    totals,
  };

  const datetimeSelection = {
    start: start || null,
    end: end || null,
    period: statsPeriod,
  };

  const yAxis = isShowingMetricsEventCount
    ? ['count()', 'tpm()']
    : ['apdex()', 'failure_rate()'];

  const requestProps = {
    ...requestCommonProps,
    organization,
    interval: getInterval(datetimeSelection),
    showLoading: false,
    includePrevious: false,
    yAxis,
    partial: true,
    referrer: 'api.performance.transaction-summary.sidebar-chart',
  };

  return (
    <EventsRequest {...requestProps}>
      {({results: eventsResults, errored, loading, reloading}) => {
        const _results = isShowingMetricsEventCount
          ? (eventsResults || []).slice(0, 1)
          : eventsResults;
        const series = _results
          ? _results.map((values, i: number) => ({
              ...values,
              yAxisIndex: i,
              xAxisIndex: i,
            }))
          : [];

        const metricsCompatibleQueryProps = {...requestProps};
        const eventsQuery = new MutableSearch(query);
        const compatibleQuery = new MutableSearch('');

        for (const queryKey of ALLOWED_QUERY_KEYS) {
          if (eventsQuery.hasFilter(queryKey)) {
            compatibleQuery.setFilterValues(
              queryKey,
              eventsQuery.getFilterValues(queryKey)
            );
          }
        }

        metricsCompatibleQueryProps.query = compatibleQuery.formatString();

        return (
          <EventsRequest
            {...metricsCompatibleQueryProps}
            api={new Client()}
            queryExtras={getMetricOnlyQueryParams()}
          >
            {metricsChartData => {
              const metricSeries = metricsChartData.results
                ? metricsChartData.results.map((values, i: number) => ({
                    ...values,
                    yAxisIndex: i,
                    xAxisIndex: i,
                  }))
                : [];

              const chartData = {series, errored, loading, reloading, chartOptions};
              const _metricsChartData = {
                ...metricsChartData,
                series: metricSeries,
                chartOptions,
              };
              if (isShowingMetricsEventCount && metricSeries.length) {
                const countSeries = series[0];

                if (countSeries) {
                  countSeries.seriesName = t('Indexed Events');
                  const trimmed = trimLeadingTrailingZeroCounts(countSeries);

                  if (trimmed) {
                    series[0] = {...countSeries, ...trimmed};
                  }
                }

                const {missingMetrics} = getDatasetCounts({
                  chartData,
                  metricsChartData: _metricsChartData,
                  metricsCardinality,
                });

                const metricsCountSeries = metricSeries[0];
                if (!missingMetrics) {
                  if (metricsCountSeries) {
                    metricsCountSeries.seriesName = t('Processed Events');
                    metricsCountSeries.lineStyle = {
                      type: 'dashed',
                      width: 1.5,
                    };
                    const trimmed = trimLeadingTrailingZeroCounts(metricsCountSeries);
                    if (trimmed) {
                      metricSeries[0] = {...metricsCountSeries, ...trimmed};
                    }
                  }
                  // @ts-expect-error TS(2345) FIXME: Argument of type '{ yAxisIndex: number; xAxisIndex... Remove this comment to see the full error message
                  series.push(metricsCountSeries);
                }
              }

              return (
                <SidebarCharts
                  {...contentCommonProps}
                  transactionName={transactionName}
                  location={location}
                  eventView={eventView}
                  chartData={chartData}
                  isShowingMetricsEventCount={isShowingMetricsEventCount}
                  metricsChartData={_metricsChartData}
                />
              );
            }}
          </EventsRequest>
        );
      }}
    </EventsRequest>
  );
}

type ChartValueProps = {
  'data-test-id': string;
  error: QueryError | null;
  isLoading: boolean;
  value: React.ReactNode;
};

function ChartSummaryValue({error, isLoading, value, ...props}: ChartValueProps) {
  if (error) {
    return <div {...props}>{'\u2014'}</div>;
  }

  if (isLoading) {
    return <Placeholder height="24px" {...props} />;
  }

  return <ChartValue {...props}>{value}</ChartValue>;
}

const RelativeBox = styled('div')`
  position: relative;
`;

const ChartTitle = styled(SectionHeading)`
  margin: 0;
`;

const ChartLabel = styled('div')<{top: string}>`
  position: absolute;
  top: ${p => p.top};
  z-index: 1;
`;

const ChartValue = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

export default withRouter(SidebarChartsContainer);
