import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
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
import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
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
import useApi from 'sentry/utils/useApi';
import {getTermHelp, PERFORMANCE_TERM} from 'sentry/views/performance/data';

type Props = WithRouterProps & {
  organization: Organization;
  location: Location;
  eventView: EventView;
  isLoading: boolean;
  error: string | null;
  totals: Record<string, number> | null;
};

function SidebarCharts({
  location,
  eventView,
  organization,
  router,
  isLoading,
  error,
  totals,
}: Props) {
  const api = useApi();
  const theme = useTheme();

  const statsPeriod = eventView.statsPeriod;
  const start = eventView.start ? getUtcToLocalDateObject(eventView.start) : undefined;
  const end = eventView.end ? getUtcToLocalDateObject(eventView.end) : undefined;
  const {utc} = getParams(location.query);

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
    utc: utc === 'true',
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

  const datetimeSelection = {
    start: start || null,
    end: end || null,
    period: statsPeriod,
  };
  const project = eventView.project;
  const environment = eventView.environment;

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
        <ChartSummaryValue
          isLoading={isLoading}
          error={error}
          value={totals ? formatFloat(totals.apdex, 4) : null}
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
        utc={utc === 'true'}
        xAxisIndex={[0, 1, 2]}
      >
        {zoomRenderProps => (
          <EventsRequest
            api={api}
            organization={organization}
            period={statsPeriod}
            project={project}
            environment={environment}
            start={start}
            end={end}
            interval={getInterval(datetimeSelection)}
            showLoading={false}
            query={eventView.query}
            includePrevious={false}
            yAxis={['apdex()', 'failure_rate()', 'epm()']}
            partial
            referrer="api.performance.transaction-summary.sidebar-chart"
          >
            {({results, errored, loading, reloading}) => {
              if (errored) {
                return (
                  <ErrorPanel height="580px">
                    <IconWarning color="gray300" size="lg" />
                  </ErrorPanel>
                );
              }
              const series = results
                ? results.map((values, i: number) => ({
                    ...values,
                    yAxisIndex: i,
                    xAxisIndex: i,
                  }))
                : [];

              return (
                <TransitionChart loading={loading} reloading={reloading} height="580px">
                  <TransparentLoadingMask visible={reloading} />
                  <LineChart {...zoomRenderProps} {...chartOptions} series={series} />
                </TransitionChart>
              );
            }}
          </EventsRequest>
        )}
      </ChartZoom>
    </RelativeBox>
  );
}

type ChartValueProps = {
  isLoading: boolean;
  error: string | null;
  value: React.ReactNode;
};

function ChartSummaryValue({error, isLoading, value}: ChartValueProps) {
  if (error) {
    return <div>{'\u2014'}</div>;
  }
  if (isLoading) {
    return <Placeholder height="24px" />;
  }
  return <ChartValue>{value}</ChartValue>;
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

export default withRouter(SidebarCharts);
