import {Fragment} from 'react';
import {browserHistory, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location} from 'history';

import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import LineChart from 'sentry/components/charts/lineChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import getDynamicText from 'sentry/utils/getDynamicText';
import {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import useApi from 'sentry/utils/useApi';

import {getExclusiveTimeDisplayedValue} from '../utils';

type Props = WithRouterProps & {
  eventView: EventView;
  location: Location;
  organization: Organization;
  spanSlug: SpanSlug;
  withoutZerofill: boolean;
};

export default function ExclusiveTimeChart(props: Props) {
  const {location, router, organization, eventView, spanSlug, withoutZerofill} = props;

  const api = useApi();
  const theme = useTheme();

  const period = eventView.statsPeriod;
  const start = eventView.start ? getUtcToLocalDateObject(eventView.start) : null;
  const end = eventView.end ? getUtcToLocalDateObject(eventView.end) : null;
  const {utc} = normalizeDateTimeParams(location.query);

  const datetimeSelection = {
    start,
    end,
    period,
  };

  const yAxis = [
    'percentileArray(spans_exclusive_time, 0.75)',
    'percentileArray(spans_exclusive_time, 0.95)',
    'percentileArray(spans_exclusive_time, 0.99)',
  ];

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

  return (
    <Fragment>
      <HeaderTitleLegend>
        {t('Self Time Breakdown')}
        <QuestionTooltip
          size="sm"
          position="top"
          title={t(
            'Self Time Breakdown reflects the span self time by percentile over time.'
          )}
        />
      </HeaderTitleLegend>
      <ChartZoom
        router={router}
        period={period}
        start={start}
        end={end}
        utc={utc === 'true'}
      >
        {zoomRenderProps => (
          <EventsRequest
            api={api}
            organization={organization}
            project={eventView.project}
            environment={eventView.environment}
            start={start}
            end={end}
            period={period}
            interval={getInterval(datetimeSelection, 'high')}
            showLoading={false}
            query={eventView.query}
            includePrevious={false}
            yAxis={yAxis}
            partial
            withoutZerofill={withoutZerofill}
            queryExtras={{span: `${spanSlug.op}:${spanSlug.group}`}}
            generatePathname={org => `/organizations/${org.slug}/events-spans-stats/`}
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
                colors: theme.charts.getColorPalette(yAxis.length - 2),
                seriesOptions: {
                  showSymbol: false,
                },
                tooltip: {
                  trigger: 'axis' as const,
                  // p50() coerces the axis to be time based
                  valueFormatter: (value, _seriesName) =>
                    tooltipFormatter(value, 'p50()'),
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

              const legend = {
                right: 10,
                top: 5,
                selected: getSeriesSelection(location),
              };

              const formattedResults = results?.map(result => ({
                ...result,
                seriesName: getExclusiveTimeDisplayedValue(result.seriesName),
              }));

              return (
                <TransitionChart loading={loading} reloading={reloading}>
                  <TransparentLoadingMask visible={reloading} />
                  {getDynamicText({
                    value: (
                      <LineChart
                        {...zoomRenderProps}
                        {...chartOptions}
                        legend={legend}
                        onLegendSelectChanged={handleLegendSelectChanged}
                        series={formattedResults ?? []}
                      />
                    ),
                    fixed: <Placeholder height="200px" />,
                  })}
                </TransitionChart>
              );
            }}
          </EventsRequest>
        )}
      </ChartZoom>
    </Fragment>
  );
}
