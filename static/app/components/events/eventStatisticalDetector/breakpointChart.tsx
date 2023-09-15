import {useTheme} from '@emotion/react';
import {LineSeriesOption} from 'echarts';

import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import {Event} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import TrendsDiscoverQuery from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TrendsChart} from 'sentry/views/performance/landing/widgets/widgets/trendsWidget';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendFunctionField,
} from 'sentry/views/performance/trends/types';

import {DataSection} from '../styles';

function camelToUnderscore(key: string) {
  return key.replace(/([A-Z\d])/g, '_$1').toLowerCase();
}

type EventBreakpointChartProps = {
  event: Event;
};

function EventBreakpointChart({event}: EventBreakpointChartProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();

  const {transaction, requestStart, requestEnd, breakpoint} =
    event?.occurrence?.evidenceData ?? {};

  const eventView = EventView.fromLocation(location);
  eventView.query = `event.type:transaction transaction:"${transaction}"`;
  eventView.fields = [{field: 'transaction'}, {field: 'project'}];
  eventView.start = new Date(requestStart * 1000).toISOString();
  eventView.end = new Date(requestEnd * 1000).toISOString();

  // If start and end were defined, then do not use default 14d stats period
  eventView.statsPeriod = requestStart && requestEnd ? '' : eventView.statsPeriod;

  // The evidence data keys are returned to us in camelCase, but we need to
  // convert them to snake_case to match the NormalizedTrendsTransaction type
  const normalizedOccurrenceEvent = Object.keys(
    event?.occurrence?.evidenceData ?? []
  ).reduce((acc, key) => {
    acc[camelToUnderscore(key)] = event?.occurrence?.evidenceData?.[key];
    return acc;
  }, {}) as NormalizedTrendsTransaction;

  const additionalSeries: LineSeriesOption[] = [];

  // Add the red marked area to the chart
  additionalSeries.push({
    name: 'Regression Area',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      animation: false,
      lineStyle: {color: theme.red300, type: 'solid', width: 2, opacity: 1.0},
      label: {
        show: false,
      },
      data: [
        {
          xAxis: breakpoint * 1000,
        },
      ],
    }),
    markArea: MarkArea({
      silent: true,
      itemStyle: {
        color: theme.red300,
        opacity: 0.2,
      },
      data: [
        [
          {
            xAxis: breakpoint * 1000,
          },
          {xAxis: requestEnd * 1000},
        ],
      ],
    }),
    data: [],
  });

  additionalSeries.push({
    name: 'Regression Axis Line',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: 'red', type: 'solid', width: 4},
      data: [[{coord: [breakpoint, 57]}, {coord: [requestEnd, 57]}]],
    }),
    data: [],
  });

  additionalSeries.push({
    name: 'Baseline Axis Line',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      label: {
        show: false,
      },
      lineStyle: {color: 'green', type: 'solid', width: 4},
      data: [{yAxis: 100}],
    }),
    data: [],
  });

  return (
    <DataSection>
      <TrendsDiscoverQuery
        orgSlug={organization.slug}
        eventView={eventView}
        location={location}
        trendChangeType={TrendChangeType.REGRESSION}
        trendFunctionField={TrendFunctionField.P95}
        limit={1}
        queryExtras={{
          withTimeseries: 'true',
          interval: '1h',
        }}
        withBreakpoint
      >
        {({trendsData, isLoading}) => {
          return (
            <TrendsChart
              organization={organization}
              isLoading={isLoading}
              statsData={trendsData?.stats ?? {}}
              query={eventView.query}
              project={eventView.project}
              environment={eventView.environment}
              start={eventView.start}
              end={eventView.end}
              statsPeriod={eventView.statsPeriod}
              transaction={normalizedOccurrenceEvent}
              trendChangeType={TrendChangeType.REGRESSION}
              trendFunctionField={TrendFunctionField.P95}
              additionalSeries={additionalSeries}
              disableLegend
            />
          );
        }}
      </TrendsDiscoverQuery>
    </DataSection>
  );
}

export default EventBreakpointChart;
