import * as React from 'react';
import * as ReactRouter from 'react-router';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import {SectionHeading} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import {LightWeightOrganization} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {tooltipFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import {
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
} from 'app/utils/formatters';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import {getTermHelp, PERFORMANCE_TERM} from 'app/views/performance/data';

type Props = ReactRouter.WithRouterProps & {
  theme: Theme;
  api: Client;
  organization: LightWeightOrganization;
  location: Location;
  eventView: EventView;
  isLoading: boolean;
  error: string | null;
  totals: Record<string, number> | null;
};

function SidebarCharts({
  theme,
  api,
  location,
  eventView,
  organization,
  router,
  isLoading,
  error,
  totals,
}: Props) {
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
  const threshold = organization.apdexThreshold;

  let apdexKey, apdexYAxis: string;
  let apdexPerformanceTerm: PERFORMANCE_TERM;
  if (organization.features.includes('project-transaction-threshold')) {
    apdexKey = 'apdex';
    apdexPerformanceTerm = PERFORMANCE_TERM.APDEX_NEW;
    apdexYAxis = 'apdex()';
  } else {
    apdexKey = `apdex_${threshold}`;
    apdexPerformanceTerm = PERFORMANCE_TERM.APDEX;
    apdexYAxis = `apdex(${organization.apdexThreshold})`;
  }

  return (
    <RelativeBox>
      <ChartLabel top="0px">
        <ChartTitle>
          {t('Apdex')}
          <QuestionTooltip
            position="top"
            title={getTermHelp(organization, apdexPerformanceTerm)}
            size="sm"
          />
        </ChartTitle>
        <ChartSummaryValue
          isLoading={isLoading}
          error={error}
          value={totals ? formatFloat(totals[apdexKey], 4) : null}
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
            yAxis={[apdexYAxis, 'failure_rate()', 'epm()']}
            partial
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
  } else if (isLoading) {
    return <Placeholder height="24px" />;
  } else {
    return <ChartValue>{value}</ChartValue>;
  }
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

export default withApi(withTheme(ReactRouter.withRouter(SidebarCharts)));
