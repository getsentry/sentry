import {Fragment} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location, Query} from 'history';

import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import LineChart from 'sentry/components/charts/lineChart';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import getDynamicText from 'sentry/utils/getDynamicText';
import useApi from 'sentry/utils/useApi';

import {transformEventStatsSmoothed} from '../../trends/utils';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = WithRouterProps &
  ViewProps & {
    location: Location;
    organization: OrganizationSummary;
    queryExtra: Query;
    trendDisplay: string;
    withoutZerofill: boolean;
  };

function TrendChart({
  project,
  environment,
  location,
  organization,
  query,
  statsPeriod,
  router,
  trendDisplay,
  queryExtra,
  withoutZerofill,
  start: propsStart,
  end: propsEnd,
}: Props) {
  const api = useApi();
  const theme = useTheme();

  const handleLegendSelectChanged = legendChange => {
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        trendsUnselectedSeries: unselected,
      },
    };
    browserHistory.push(to);
  };

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const {utc} = normalizeDateTimeParams(location.query);

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location, 'trendsUnselectedSeries'),
  };

  const datetimeSelection = {
    start,
    end,
    period: statsPeriod,
  };

  return (
    <Fragment>
      <HeaderTitleLegend>
        {t('Trend')}
        <QuestionTooltip
          size="sm"
          position="top"
          title={t(`Trends shows the smoothed value of an aggregate over time.`)}
        />
      </HeaderTitleLegend>
      <ChartZoom
        router={router}
        period={statsPeriod}
        start={start}
        end={end}
        utc={utc === 'true'}
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
            interval={getInterval(datetimeSelection, 'high')}
            showLoading={false}
            query={query}
            includePrevious={false}
            yAxis={trendDisplay}
            currentSeriesNames={[trendDisplay]}
            partial
            withoutZerofill={withoutZerofill}
            referrer="api.performance.transaction-summary.trends-chart"
          >
            {({errored, loading, reloading, timeseriesData, timeframe}) => {
              if (errored) {
                return (
                  <ErrorPanel>
                    <IconWarning color="gray300" size="lg" />
                  </ErrorPanel>
                );
              }

              const chartOptions = {
                grid: {
                  left: '10px',
                  right: '10px',
                  top: '40px',
                  bottom: '0px',
                },
                seriesOptions: {
                  showSymbol: false,
                },
                tooltip: {
                  trigger: 'axis' as const,
                  valueFormatter: value => tooltipFormatter(value, 'p50()'),
                },
                xAxis: timeframe
                  ? {
                      min: timeframe.start,
                      max: timeframe.end,
                    }
                  : undefined,
                yAxis: {
                  min: 0,
                  axisLabel: {
                    color: theme.chartLabel,
                    // p50() coerces the axis to be time based
                    formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
                  },
                },
              };

              const series = timeseriesData
                ? timeseriesData
                    .map(values => {
                      return {
                        ...values,
                        color: theme.purple300,
                        lineStyle: {
                          opacity: 0.75,
                          width: 1,
                        },
                      };
                    })
                    .reverse()
                : [];

              const {smoothedResults} = transformEventStatsSmoothed(
                timeseriesData,
                t('Smoothed')
              );

              const smoothedSeries = smoothedResults
                ? smoothedResults.map(values => {
                    return {
                      ...values,
                      color: theme.purple300,
                      lineStyle: {
                        opacity: 1,
                      },
                    };
                  })
                : [];

              return (
                <ReleaseSeries
                  start={start}
                  end={end}
                  queryExtra={queryExtra}
                  period={statsPeriod}
                  utc={utc === 'true'}
                  projects={project}
                  environments={environment}
                >
                  {({releaseSeries}) => (
                    <TransitionChart loading={loading} reloading={reloading}>
                      <TransparentLoadingMask visible={reloading} />
                      {getDynamicText({
                        value: (
                          <LineChart
                            {...zoomRenderProps}
                            {...chartOptions}
                            legend={legend}
                            onLegendSelectChanged={handleLegendSelectChanged}
                            series={[...series, ...smoothedSeries, ...releaseSeries]}
                          />
                        ),
                        fixed: <Placeholder height="200px" testId="skeleton-ui" />,
                      })}
                    </TransitionChart>
                  )}
                </ReleaseSeries>
              );
            }}
          </EventsRequest>
        )}
      </ChartZoom>
    </Fragment>
  );
}

export default withRouter(TrendChart);
