import {useTheme} from '@emotion/react';

import ChartZoom from 'sentry/components/charts/chartZoom';
import {
  LineChart as EchartsLineChart,
  LineChartProps,
} from 'sentry/components/charts/lineChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {DataSection} from 'sentry/components/events/styles';
import {Event, EventsStatsData} from 'sentry/types';
import {getUserTimezone} from 'sentry/utils/dates';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {transformEventStats} from 'sentry/views/performance/trends/chart';
import {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';
import {getIntervalLine, IntervalLineFormat} from 'sentry/views/performance/utils';

function camelToUnderscore(key: string) {
  return key.replace(/([A-Z\d])/g, '_$1').toLowerCase();
}

type TransactionFrequencyChartProps = {
  event: Event;
};

function TransactionFrequencyChart({event}: TransactionFrequencyChartProps) {
  const location = useLocation();
  const organization = useOrganization();

  const {transaction, breakpoint} = event?.occurrence?.evidenceData ?? {};

  const eventView = EventView.fromLocation(location);
  eventView.query = `event.type:transaction transaction:"${transaction}"`;
  eventView.dataset = DiscoverDatasets.METRICS;

  const {start: beforeDateTime, end: afterDateTime} = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 14,
  });

  eventView.start = (beforeDateTime as Date).toISOString();
  eventView.end = (afterDateTime as Date).toISOString();
  eventView.statsPeriod = undefined;

  // The evidence data keys are returned to us in camelCase, but we need to
  // convert them to snake_case to match the NormalizedTrendsTransaction type
  const normalizedOccurrenceEvent = Object.keys(
    event?.occurrence?.evidenceData ?? []
  ).reduce((acc, key) => {
    acc[camelToUnderscore(key)] = event?.occurrence?.evidenceData?.[key];
    return acc;
  }, {}) as NormalizedTrendsTransaction;

  const {data, isLoading} = useGenericDiscoverQuery<
    {
      data: EventsStatsData;
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: 'events-stats',
    location,
    eventView,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      // Manually inject y-axis for events-stats because
      // getEventsAPIPayload doesn't pass it along
      ...eventView.getEventsAPIPayload(location),
      yAxis: 'count()',
    }),
  });

  return (
    <DataSection>
      <TransitionChart loading={isLoading} reloading>
        <TransparentLoadingMask visible={isLoading} />
        <Chart
          statsData={data?.data ?? []}
          evidenceData={normalizedOccurrenceEvent}
          start={eventView.start}
          end={eventView.end}
          chartLabel="TPM"
        />
      </TransitionChart>
    </DataSection>
  );
}

interface ChartProps {
  chartLabel: string;
  end: string;
  evidenceData: NormalizedTrendsTransaction;
  start: string;
  statsData: EventsStatsData;
}

function Chart({statsData, evidenceData, start, end, chartLabel}: ChartProps) {
  const theme = useTheme();
  const router = useRouter();

  const resultSeries = transformEventStats(statsData, chartLabel);

  const needsLabel = true;
  const intervalSeries = getIntervalLine(
    theme,
    resultSeries || [],
    0.5,
    needsLabel,
    evidenceData,
    IntervalLineFormat.REGRESSION_EPM
  );

  const series = [...resultSeries, ...intervalSeries];

  const durationUnit = getDurationUnit(series);

  const chartOptions: Omit<LineChartProps, 'series'> = {
    tooltip: {
      valueFormatter: (value, seriesName) => {
        return tooltipFormatter(value, aggregateOutputType(seriesName));
      },
    },
    yAxis: {
      minInterval: durationUnit,
      axisLabel: {
        color: theme.chartLabel,
        formatter: (value: number) =>
          axisLabelFormatter(value, 'rate', undefined, durationUnit),
      },
    },
  };

  return (
    <ChartZoom router={router} start={start} end={end} utc={getUserTimezone() === 'UTC'}>
      {zoomRenderProps => {
        return (
          <EchartsLineChart
            {...zoomRenderProps}
            {...chartOptions}
            series={series}
            seriesOptions={{
              showSymbol: false,
            }}
            toolBox={{
              show: false,
            }}
            grid={{
              left: '10px',
              right: '10px',
              top: '20px',
              bottom: '0px',
            }}
          />
        );
      }}
    </ChartZoom>
  );
}

export default TransactionFrequencyChart;
