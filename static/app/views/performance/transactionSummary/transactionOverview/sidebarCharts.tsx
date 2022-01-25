import * as React from 'react';
import {InjectedRouter, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import LineChart from 'sentry/components/charts/lineChart';
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
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {TransactionMetric} from 'sentry/utils/metrics/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {getTermHelp, PERFORMANCE_TERM} from 'sentry/views/performance/data';
import {transformMetricsToArea} from 'sentry/views/performance/landing/widgets/transforms/transformMetricsToArea';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';

type ContainerProps = WithRouterProps & {
  organization: Organization;
  location: Location;
  eventView: EventView;
  isLoading: boolean;
  error: string | null;
  totals: Record<string, number> | null;
  isMetricsData?: boolean;
};

type Props = Pick<
  ContainerProps,
  'organization' | 'isLoading' | 'error' | 'totals' | 'isMetricsData'
> & {
  utc: boolean;
  router: InjectedRouter;
  chartData: {
    errored: boolean;
    loading: boolean;
    reloading: boolean;
    chartOptions: Record<string, any>;
    series: React.ComponentProps<typeof LineChart>['series'];
  };
  statsPeriod?: string | null;
  start?: Date;
  end?: Date;
};

function SidebarCharts({
  organization,
  isLoading,
  error,
  totals,
  start,
  end,
  utc,
  router,
  statsPeriod,
  chartData,
  isMetricsData,
}: Props) {
  return (
    <RelativeBox>
      <ChartLabel top="0px">
        <ChartTitle>
          {t('Apdex')}
          <QuestionTooltip
            position="top"
            title={getTermHelp(organization, PERFORMANCE_TERM.APDEX_NEW)}
            size="sm"
          />
        </ChartTitle>
        {isMetricsData ? (
          'TODO Metrics'
        ) : (
          <ChartSummaryValue
            data-test-id="apdex-summary-value"
            isLoading={isLoading}
            error={error}
            value={isMetricsData ? null : totals ? formatFloat(totals.apdex, 4) : null}
          />
        )}
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
          value={totals ? formatPercentage(totals.failure_rate) : null}
        />
      </ChartLabel>

      <ChartLabel top="320px">
        <ChartTitle>
          {t('TPM')}
          <QuestionTooltip
            position="top"
            title={getTermHelp(organization, PERFORMANCE_TERM.TPM)}
            size="sm"
          />
        </ChartTitle>
        <ChartSummaryValue
          data-test-id="tpm-summary-value"
          isLoading={isLoading}
          error={error}
          value={totals ? tct('[tpm] tpm', {tpm: formatFloat(totals.tpm, 4)}) : null}
        />
      </ChartLabel>

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
              <ErrorPanel height="580px">
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
                fixed: <Placeholder height="480px" testId="skeleton-ui" />,
              })}
            </TransitionChart>
          );
        }}
      </ChartZoom>
    </RelativeBox>
  );
}

function SidebarChartsContainer({
  location,
  eventView,
  organization,
  router,
  isLoading,
  error,
  totals,
  isMetricsData,
}: ContainerProps) {
  const api = useApi();
  const theme = useTheme();

  const colors = theme.charts.getColorPalette(3);
  const statsPeriod = eventView.statsPeriod;
  const start = eventView.start ? getUtcToLocalDateObject(eventView.start) : undefined;
  const end = eventView.end ? getUtcToLocalDateObject(eventView.end) : undefined;
  const project = eventView.project;
  const environment = eventView.environment;
  const query = eventView.query;
  const utc = normalizeDateTimeParams(location.query).utc === 'true';

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

  const chartOptions = {
    height: 480,
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
      {
        top: '380px',
        left: '10px',
        right: '10px',
        height: '120px',
      },
    ],
    axisPointer: {
      // Link each x-axis together.
      link: [{xAxisIndex: [0, 1, 2]}],
    },
    xAxes: Array.from(new Array(3)).map((_i, index) => ({
      gridIndex: index,
      type: 'time' as const,
      show: false,
    })),
    yAxes: [
      {
        // apdex
        gridIndex: 0,
        interval: 0.2,
        axisLabel: {
          formatter: (value: number) => formatFloat(value, 1),
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
      {
        // throughput
        gridIndex: 2,
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
    colors: [colors[0], colors[1], colors[2]] as string[],
    tooltip: {
      trigger: 'axis' as const,
      truncate: 80,
      valueFormatter: tooltipFormatter,
      nameFormatter(value: string) {
        return value === 'epm()' ? 'tpm()' : value;
      },
    },
  };

  const requestCommonProps = {
    api,
    start,
    end,
    statsPeriod,
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

  if (isMetricsData) {
    const fields = [
      `count(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
    ];

    chartOptions.tooltip.nameFormatter = (name: string) => {
      return name === 'failure_rate()' ? fields[0] : name;
    };

    // Fetch failure rate metrics
    return (
      <MetricsRequest
        {...requestCommonProps}
        query={new MutableSearch(requestCommonProps.query).formatString()} // TODO(metrics): not all tags will be compatible with metrics
        orgSlug={organization.slug}
        field={fields}
        groupBy={['transaction.status']}
      >
        {failureRateRequestProps => {
          const failureRateData = transformMetricsToArea(
            {
              location,
              fields,
              chartSetting: PerformanceWidgetSetting.FAILURE_RATE_AREA,
            },
            failureRateRequestProps
          );

          const failureRateSerie = failureRateData.data.map(values => ({
            ...values,
            seriesName: 'failure_rate()',
            yAxisIndex: 1,
            xAxisIndex: 1,
          }));

          // Fetch trasaction per minute metrics
          return (
            <MetricsRequest
              api={api}
              orgSlug={organization.slug}
              start={start}
              end={end}
              statsPeriod={statsPeriod}
              project={project}
              environment={environment}
              query={new MutableSearch(query).formatString()} // TODO(metrics): not all tags will be compatible with metrics
              field={fields}
            >
              {tpmRequestProps => {
                const tpmData = transformMetricsToArea(
                  {
                    location,
                    fields,
                    chartSetting: PerformanceWidgetSetting.TPM_AREA,
                  },
                  tpmRequestProps
                );

                const tpmSerie = tpmData.data.map(values => ({
                  ...values,
                  yAxisIndex: 2,
                  xAxisIndex: 2,
                }));

                return (
                  <SidebarCharts
                    {...contentCommonProps}
                    totals={{
                      failure_rate: failureRateData.dataMean?.[0].mean ?? 0,
                      tpm: tpmData.dataMean?.[0].mean ?? 0,
                    }}
                    isLoading={failureRateRequestProps.loading || tpmRequestProps.loading}
                    error={
                      failureRateRequestProps.errored || tpmRequestProps.errored
                        ? t('Error fetching metrics data')
                        : null
                    }
                    chartData={{
                      loading: failureRateRequestProps.loading || tpmRequestProps.loading,
                      reloading:
                        failureRateRequestProps.reloading || tpmRequestProps.reloading,
                      errored: failureRateRequestProps.errored || tpmRequestProps.errored,
                      chartOptions,
                      series: [...failureRateSerie, ...tpmSerie],
                    }}
                    isMetricsData
                  />
                );
              }}
            </MetricsRequest>
          );
        }}
      </MetricsRequest>
    );
  }

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
      yAxis={['apdex()', 'failure_rate()', 'epm()']}
      partial
      referrer="api.performance.transaction-summary.sidebar-chart"
    >
      {({results, errored, loading, reloading}) => {
        const series = results
          ? results.map((values, i: number) => ({
              ...values,
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
  isLoading: boolean;
  error: string | null;
  value: React.ReactNode;
  'data-test-id': string;
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
