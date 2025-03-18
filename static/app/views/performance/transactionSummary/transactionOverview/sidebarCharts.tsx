import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import type {LineChartProps} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {SectionHeading} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {getChartColorPalette} from 'sentry/constants/chartPalette';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import type EventView from 'sentry/utils/discover/eventView';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import type {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import getDynamicText from 'sentry/utils/getDynamicText';
import {formatFloat} from 'sentry/utils/number/formatFloat';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';
import {getTransactionMEPParamsIfApplicable} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';

type ContainerProps = {
  error: QueryError | null;
  eventView: EventView;
  isLoading: boolean;
  organization: Organization;
  totals: Record<string, number> | null;
  transactionName: string;
};

type Props = Pick<ContainerProps, 'organization' | 'isLoading' | 'error' | 'totals'> & {
  chartData: {
    chartOptions: Omit<LineChartProps, 'series'>;
    errored: boolean;
    loading: boolean;
    reloading: boolean;
    series: LineChartProps['series'];
  };
  utc: boolean;
  end?: Date;
  start?: Date;
  statsPeriod?: string | null;
};

function SidebarCharts({
  organization,
  isLoading,
  error,
  totals,
  start,
  end,
  utc,
  statsPeriod,
  chartData,
}: Props) {
  return (
    <RelativeBox>
      <ChartLabel top="0px">
        <ChartTitle>
          {t('Apdex')}
          <QuestionTooltip
            position="top"
            title={getTermHelp(organization, PerformanceTerm.APDEX)}
            size="sm"
          />
        </ChartTitle>
        <ChartSummaryValue
          data-test-id="apdex-summary-value"
          isLoading={isLoading}
          error={error}
          value={totals ? formatFloat(totals['apdex()']!, 4) : null}
        />
      </ChartLabel>

      <ChartLabel top="160px">
        <ChartTitle>
          {t('Failure Rate')}
          <QuestionTooltip
            position="top"
            title={getTermHelp(organization, PerformanceTerm.FAILURE_RATE)}
            size="sm"
          />
        </ChartTitle>
        <ChartSummaryValue
          data-test-id="failure-rate-summary-value"
          isLoading={isLoading}
          error={error}
          value={totals ? formatPercentage(totals['failure_rate()']!) : null}
        />
      </ChartLabel>

      <ChartZoom
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
              <ErrorPanel height="300px">
                <IconWarning color="gray300" size="lg" />
              </ErrorPanel>
            );
          }

          return (
            <TransitionChart loading={loading} reloading={reloading} height="580px">
              <TransparentLoadingMask visible={reloading} />
              {getDynamicText({
                value: (
                  <LineChart {...zoomRenderProps} {...chartOptions} series={series} />
                ),
                fixed: <Placeholder height="300px" testId="skeleton-ui" />,
              })}
            </TransitionChart>
          );
        }}
      </ChartZoom>
    </RelativeBox>
  );
}

function SidebarChartsContainer({
  eventView,
  organization,
  isLoading,
  error,
  totals,
}: ContainerProps) {
  const location = useLocation();
  const api = useApi();
  const theme = useTheme();

  const colors = getChartColorPalette(2);
  const statsPeriod = eventView.statsPeriod;
  const start = eventView.start ? getUtcToLocalDateObject(eventView.start) : undefined;
  const end = eventView.end ? getUtcToLocalDateObject(eventView.end) : undefined;
  const project = eventView.project;
  const environment = eventView.environment;
  const query = eventView.query;
  const utc = normalizeDateTimeParams(location.query).utc === 'true';

  const mepSetting = useMEPSettingContext();
  const mepCardinalityContext = useMetricsCardinalityContext();
  const queryExtras = getTransactionMEPParamsIfApplicable(
    mepSetting,
    mepCardinalityContext,
    organization
  );

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
    colors: [colors[0]!, colors[1]!],
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

  return (
    <EventsRequest
      {...requestCommonProps}
      organization={organization}
      interval={getInterval(datetimeSelection)}
      showLoading={false}
      includePrevious={false}
      yAxis={['apdex()', 'failure_rate()']}
      partial
      referrer="api.performance.transaction-summary.sidebar-chart"
      queryExtras={queryExtras}
    >
      {({results, errored, loading, reloading}) => {
        const series = results
          ? results.map((v, i: number) => ({
              ...v,
              yAxisIndex: i,
              xAxisIndex: i,
            }))
          : [];

        return (
          <SidebarCharts
            {...contentCommonProps}
            chartData={{series, errored, loading, reloading, chartOptions}}
          />
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

export default SidebarChartsContainer;
