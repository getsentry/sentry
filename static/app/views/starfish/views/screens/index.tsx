import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {ScreensBarChart} from 'sentry/views/starfish/views/screens/screenBarChart';
import {
  ScreensTable,
  useTableQuery,
} from 'sentry/views/starfish/views/screens/screensTable';

export enum YAxis {
  WARM_START,
  COLD_START,
  TTID,
  TTFD,
  SLOW_FRAME_RATE,
  FROZEN_FRAME_RATE,
  THROUGHPUT,
  COUNT,
}

export const TOP_SCREENS = 5;

export const YAXIS_COLUMNS: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: 'avg(measurements.app_start_warm)',
  [YAxis.COLD_START]: 'avg(measurements.app_start_cold)',
  [YAxis.TTID]: 'avg(measurements.time_to_initial_display)',
  [YAxis.TTFD]: 'avg(measurements.time_to_full_display)',
  [YAxis.SLOW_FRAME_RATE]: 'avg(measurements.frames_slow_rate)',
  [YAxis.FROZEN_FRAME_RATE]: 'avg(measurements.frames_frozen_rate)',
  [YAxis.THROUGHPUT]: 'tpm()',
  [YAxis.COUNT]: 'count()',
};

export const READABLE_YAXIS_LABELS: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: 'avg(app_start_warm)',
  [YAxis.COLD_START]: 'avg(app_start_cold)',
  [YAxis.TTID]: 'avg(time_to_initial_display)',
  [YAxis.TTFD]: 'avg(time_to_full_display)',
  [YAxis.SLOW_FRAME_RATE]: 'avg(frames_slow_rate)',
  [YAxis.FROZEN_FRAME_RATE]: 'avg(frames_frozen_rate)',
  [YAxis.THROUGHPUT]: 'tpm()',
  [YAxis.COUNT]: 'count()',
};

export const CHART_TITLES: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: t('Warm Start'),
  [YAxis.COLD_START]: t('Cold Start'),
  [YAxis.TTID]: t('Time To Initial Display'),
  [YAxis.TTFD]: t('Time To Full Display'),
  [YAxis.SLOW_FRAME_RATE]: t('Slow Frame Rate'),
  [YAxis.FROZEN_FRAME_RATE]: t('Frozen Frame Rate'),
  [YAxis.THROUGHPUT]: t('Throughput'),
  [YAxis.COUNT]: t('Count'),
};

export const OUTPUT_TYPE: Readonly<Record<YAxis, AggregationOutputType>> = {
  [YAxis.WARM_START]: 'duration',
  [YAxis.COLD_START]: 'duration',
  [YAxis.TTID]: 'duration',
  [YAxis.TTFD]: 'duration',
  [YAxis.SLOW_FRAME_RATE]: 'percentage',
  [YAxis.FROZEN_FRAME_RATE]: 'percentage',
  [YAxis.THROUGHPUT]: 'number',
  [YAxis.COUNT]: 'number',
};

type Props = {
  yAxes: YAxis[];
  additionalFilters?: string[];
  chartHeight?: number;
};

export function ScreensView({yAxes, additionalFilters, chartHeight}: Props) {
  const pageFilter = usePageFilters();
  const {selection} = pageFilter;
  const location = useLocation();
  const theme = useTheme();
  const {query: locationQuery} = location;

  const yAxisCols = yAxes.map(val => YAXIS_COLUMNS[val]);

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const query = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(additionalFilters ?? []),
  ]);
  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const orderby = decodeScalar(locationQuery.sort, `-count`);
  const newQuery: NewQuery = {
    name: '',
    fields: [
      'transaction',
      SpanMetricsField.PROJECT_ID,
      `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`,
      'count()',
    ],
    query: queryString,
    dataset: DiscoverDatasets.METRICS,
    version: 2,
    projects: selection.projects,
  };
  newQuery.orderby = orderby;
  const tableEventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const {
    data: topTransactionsData,
    isLoading: topTransactionsLoading,
    pageLinks,
  } = useTableQuery({
    eventView: tableEventView,
    enabled: !isReleasesLoading,
  });

  const topTransactions =
    topTransactionsData?.data?.slice(0, 5).map(datum => datum.transaction as string) ??
    [];

  const topEventsQuery = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(topTransactions.length > 0 ? [`transaction:[${topTransactions.join()}]`] : []),
    ...(additionalFilters ?? []),
  ]);

  const topEventsQueryString = appendReleaseFilters(
    topEventsQuery,
    primaryRelease,
    secondaryRelease
  );

  const {data: releaseEvents, isLoading: isReleaseEventsLoading} = useTableQuery({
    eventView: EventView.fromNewQueryWithLocation(
      {
        name: '',
        fields: ['transaction', 'release', ...yAxisCols],
        orderby: yAxisCols[0],
        yAxis: yAxisCols,
        query: topEventsQueryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
      },
      location
    ),
    enabled: !topTransactionsLoading,
  });

  const {data: deviceClassEvents, isLoading: isDeviceClassEventsLoading} = useTableQuery({
    eventView: EventView.fromNewQueryWithLocation(
      {
        name: '',
        fields: ['transaction', 'device.class', ...yAxisCols],
        orderby: yAxisCols[0],
        yAxis: yAxisCols,
        query: topEventsQueryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      location
    ),
    enabled: !topTransactionsLoading,
  });

  if (isReleasesLoading) {
    return (
      <LoadingContainer>
        <LoadingIndicator />
      </LoadingContainer>
    );
  }

  const transformedReleaseEvents: {
    [yAxisName: string]: {
      [releaseVersion: string]: Series;
    };
  } = {};

  yAxes.forEach(val => {
    transformedReleaseEvents[YAXIS_COLUMNS[val]] = {};
    if (primaryRelease) {
      transformedReleaseEvents[YAXIS_COLUMNS[val]][primaryRelease] = {
        seriesName: primaryRelease,
        data: Array(topTransactions.length).fill(0),
      };
    }
    if (secondaryRelease) {
      transformedReleaseEvents[YAXIS_COLUMNS[val]][secondaryRelease] = {
        seriesName: secondaryRelease,
        data: Array(topTransactions.length).fill(0),
      };
    }
  });

  const transformedDeviceEvents: {
    [yAxisName: string]: {
      [deviceClass: string]: Series;
    };
  } = {};

  yAxes.forEach(val => {
    transformedDeviceEvents[YAXIS_COLUMNS[val]] = {};
    ['high', 'medium', 'low', 'Unknown'].forEach(deviceClass => {
      transformedDeviceEvents[YAXIS_COLUMNS[val]][deviceClass] = {
        seriesName: deviceClass,
        data: Array(topTransactions.length).fill(0),
      };
    });
  });

  const topTransactionsIndex = Object.fromEntries(topTransactions.map((e, i) => [e, i]));

  if (defined(releaseEvents)) {
    releaseEvents.data?.forEach(row => {
      const release = row.release;
      const isPrimary = release === primaryRelease;
      const transaction = row.transaction;
      const index = topTransactionsIndex[transaction];
      yAxes.forEach(val => {
        transformedReleaseEvents[YAXIS_COLUMNS[val]][release].data[index] = {
          name: row.transaction,
          value: row[YAXIS_COLUMNS[val]],
          itemStyle: {
            color: isPrimary
              ? theme.charts.getColorPalette(TOP_SCREENS - 2)[index]
              : Color(theme.charts.getColorPalette(TOP_SCREENS - 2)[index])
                  .lighten(0.5)
                  .string(),
          },
        } as SeriesDataUnit;
      });
    });
  }

  if (defined(deviceClassEvents)) {
    deviceClassEvents.data?.forEach(row => {
      const deviceClass = row['device.class'];
      const transaction = row.transaction;
      const index = topTransactionsIndex[transaction];

      function deviceClassColor() {
        switch (deviceClass) {
          case 'high':
            return theme.charts.getColorPalette(TOP_SCREENS - 2)[index];

          case 'medium':
            return Color(theme.charts.getColorPalette(TOP_SCREENS - 2)[index])
              .lighten(0.2)
              .string();

          case 'low':
            return Color(theme.charts.getColorPalette(TOP_SCREENS - 2)[index])
              .lighten(0.4)
              .string();

          default:
            return Color(theme.charts.getColorPalette(TOP_SCREENS - 2)[index])
              .lighten(0.6)
              .string();
        }
      }

      yAxes.forEach(val => {
        transformedDeviceEvents[YAXIS_COLUMNS[val]][deviceClass].data[index] = {
          name: row.transaction,
          value: row[YAXIS_COLUMNS[val]],
          itemStyle: {
            color: deviceClassColor(),
          },
        } as SeriesDataUnit;
      });
    });
  }

  return (
    <div data-test-id="starfish-mobile-view">
      <ChartsContainer>
        <Fragment>
          <ChartsContainerItem key="release">
            <ScreensBarChart
              chartOptions={yAxes.map(yAxis => {
                return {
                  title: t('%s by Release', CHART_TITLES[yAxis]),
                  yAxis: YAXIS_COLUMNS[yAxis],
                  xAxisLabel: topTransactions,
                  series: Object.values(transformedReleaseEvents[YAXIS_COLUMNS[yAxis]]),
                };
              })}
              chartHeight={chartHeight ?? 180}
              isLoading={isReleaseEventsLoading}
            />
          </ChartsContainerItem>

          <ChartsContainerItem key="deviceClass">
            <ScreensBarChart
              chartOptions={yAxes.map(yAxis => {
                return {
                  title: t('%s by Device Class', CHART_TITLES[yAxis]),
                  yAxis: YAXIS_COLUMNS[yAxis],
                  xAxisLabel: topTransactions,
                  series: Object.values(transformedDeviceEvents[YAXIS_COLUMNS[yAxis]]),
                };
              })}
              chartHeight={chartHeight ?? 180}
              isLoading={isDeviceClassEventsLoading}
            />
          </ChartsContainerItem>
        </Fragment>
      </ChartsContainer>
      <ScreensTable
        eventView={tableEventView}
        data={topTransactionsData}
        isLoading={topTransactionsLoading}
        pageLinks={pageLinks}
      />
    </div>
  );
}

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;

export const Spacer = styled('div')`
  margin-top: ${space(3)};
`;
