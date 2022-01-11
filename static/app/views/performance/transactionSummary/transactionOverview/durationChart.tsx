import {Fragment} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location, Query} from 'history';

import AreaChart from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import getDynamicText from 'sentry/utils/getDynamicText';
import useApi from 'sentry/utils/useApi';

import {
  SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD,
  SpanOperationBreakdownFilter,
} from '../filter';

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
    currentFilter: SpanOperationBreakdownFilter;
    withoutZerofill: boolean;
  };

function generateYAxisValues(currentFilter: SpanOperationBreakdownFilter) {
  const field = SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD[currentFilter] ?? '';
  return [
    `p50(${field})`,
    `p75(${field})`,
    `p95(${field})`,
    `p99(${field})`,
    `p100(${field})`,
  ];
}

/**
 * Fetch and render a stacked area chart that shows duration percentiles over
 * the past 7 days
 */
function DurationChart({
  project,
  environment,
  location,
  organization,
  query,
  statsPeriod,
  router,
  queryExtra,
  currentFilter,
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
        unselectedSeries: unselected,
      },
    };
    browserHistory.push(to);
  };

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const {utc} = normalizeDateTimeParams(location.query);

  const legend = {
    right: 10,
    top: 5,
    selected: getSeriesSelection(location),
  };

  const datetimeSelection = {
    start,
    end,
    period: statsPeriod,
  };

  const headerTitle =
    currentFilter === SpanOperationBreakdownFilter.None
      ? t('Duration Breakdown')
      : tct('Span Operation Breakdown - [operationName]', {
          operationName: currentFilter,
        });

  return (
    <Fragment>
      <HeaderTitleLegend>
        {headerTitle}
        <QuestionTooltip
          size="sm"
          position="top"
          title={t(
            `Duration Breakdown reflects transaction durations by percentile over time.`
          )}
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
            yAxis={generateYAxisValues(currentFilter)}
            partial
            withoutZerofill={withoutZerofill}
            referrer="api.performance.transaction-summary.duration-chart"
          >
            {({results, errored, loading, reloading, timeframe}) => {
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
                  valueFormatter: tooltipFormatter,
                },
                xAxis: timeframe
                  ? {
                      min: timeframe.start,
                      max: timeframe.end,
                    }
                  : undefined,
                yAxis: {
                  axisLabel: {
                    color: theme.chartLabel,
                    // p50() coerces the axis to be time based
                    formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
                  },
                },
              };

              const colors =
                (results && theme.charts.getColorPalette(results.length - 2)) || [];

              // Create a list of series based on the order of the fields,
              // We need to flip it at the end to ensure the series stack right.
              const series = results
                ? results
                    .map((values, i: number) => {
                      return {
                        ...values,
                        color: colors[i],
                        lineStyle: {
                          opacity: 0,
                        },
                      };
                    })
                    .reverse()
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
                          <AreaChart
                            {...zoomRenderProps}
                            {...chartOptions}
                            legend={legend}
                            onLegendSelectChanged={handleLegendSelectChanged}
                            series={[...series, ...releaseSeries]}
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

export default withRouter(DurationChart);
