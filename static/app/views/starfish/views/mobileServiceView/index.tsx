import {Fragment} from 'react';
import styled from '@emotion/styled';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {ViewsList} from 'sentry/views/starfish/views/mobileServiceView/viewsList';

const READABLE_YAXIS_LABELS = {
  'avg(measurements.app_start_cold)': 'avg(app_start_cold)',
  'avg(measurements.app_start_warm)': 'avg(app_start_warm)',
  'avg(measurements.time_to_initial_display)': 'avg(time_to_initial_display)',
  'avg(measurements.time_to_full_display)': 'avg(time_to_full_display)',
  'avg(measurements.frames_slow_rate)': 'avg(frames_slow_rate)',
  'avg(measurements.frames_frozen_rate)': 'avg(frames_frozen_rate)',
};

export function MobileStarfishView() {
  const pageFilter = usePageFilters();
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const query = new MutableSearch(['event.type:transaction', 'transaction.op:ui.load']);

  useSynchronizeCharts();
  const {
    isLoading: seriesIsLoading,
    data: firstReleaseSeries,
    isError,
  } = useEventsStatsQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: [],
        yAxis: [
          'avg(measurements.app_start_cold)',
          'avg(measurements.app_start_warm)',
          'avg(measurements.time_to_initial_display)',
          'avg(measurements.time_to_full_display)',
          'avg(measurements.frames_slow_rate)',
          'avg(measurements.frames_frozen_rate)',
        ],
        query:
          defined(primaryRelease) && primaryRelease !== ''
            ? query.copy().addStringFilter(`release:${primaryRelease}`).formatString()
            : query.formatString(),
        dataset: DiscoverDatasets.METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      pageFilter.selection
    ),
    enabled: !isReleasesLoading,
    referrer: 'api.starfish-web-service.span-category-breakdown-timeseries',
    initialData: {},
  });

  const {data: secondReleaseSeries} = useEventsStatsQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: [],
        yAxis: [
          'avg(measurements.app_start_cold)',
          'avg(measurements.app_start_warm)',
          'avg(measurements.time_to_initial_display)',
          'avg(measurements.time_to_full_display)',
          'avg(measurements.frames_slow_rate)',
          'avg(measurements.frames_frozen_rate)',
        ],
        query:
          defined(secondaryRelease) && secondaryRelease !== ''
            ? query.copy().addStringFilter(`release:${secondaryRelease}`).formatString()
            : query.formatString(),
        dataset: DiscoverDatasets.METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      pageFilter.selection
    ),
    enabled: !isReleasesLoading && primaryRelease !== secondaryRelease,
    referrer: 'api.starfish-web-service.span-category-breakdown-timeseries',
    initialData: {},
  });

  if (isReleasesLoading) {
    return <LoadingContainer />;
  }

  function renderCharts() {
    const transformedSeries: {[yAxisName: string]: Series[]} = {
      'avg(measurements.app_start_cold)': [],
      'avg(measurements.app_start_warm)': [],
      'avg(measurements.time_to_initial_display)': [],
      'avg(measurements.time_to_full_display)': [],
      'avg(measurements.frames_slow_rate)': [],
      'avg(measurements.frames_frozen_rate)': [],
    };

    if (defined(firstReleaseSeries)) {
      Object.keys(firstReleaseSeries).forEach(yAxis => {
        const label = `${primaryRelease}`;
        if (yAxis in transformedSeries) {
          transformedSeries[yAxis].push({
            seriesName: label,
            color: CHART_PALETTE[1][0],
            data:
              firstReleaseSeries[yAxis]?.data.map(datum => {
                return {
                  name: datum[0] * 1000,
                  value: datum[1][0].count,
                } as SeriesDataUnit;
              }) ?? [],
          });
        }
      });
    }

    if (defined(secondReleaseSeries)) {
      Object.keys(secondReleaseSeries).forEach(yAxis => {
        const label = `${secondaryRelease}`;
        if (yAxis in transformedSeries) {
          transformedSeries[yAxis].push({
            seriesName: label,
            color: CHART_PALETTE[1][1],
            data:
              secondReleaseSeries[yAxis]?.data.map(datum => {
                return {
                  name: datum[0] * 1000,
                  value: datum[1][0].count,
                } as SeriesDataUnit;
              }) ?? [],
          });
        }
      });
    }

    return (
      <Fragment>
        <ChartsContainerItem>
          <MiniChartPanel title={t('App Initialization')}>
            <SubTitle>
              {READABLE_YAXIS_LABELS['avg(measurements.app_start_cold)']}
            </SubTitle>
            <Chart
              height={125}
              data={transformedSeries['avg(measurements.app_start_cold)']}
              loading={seriesIsLoading}
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '0',
              }}
              showLegend
              definedAxisTicks={2}
              isLineChart
              aggregateOutputFormat="duration"
              tooltipFormatterOptions={{
                valueFormatter: value =>
                  tooltipFormatterUsingAggregateOutputType(value, 'duration'),
              }}
              errored={isError}
            />

            <Spacer />

            <SubTitle>
              {READABLE_YAXIS_LABELS['avg(measurements.app_start_warm)']}
            </SubTitle>
            <Chart
              height={125}
              data={transformedSeries['avg(measurements.app_start_warm)']}
              loading={seriesIsLoading}
              showLegend
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '0',
              }}
              aggregateOutputFormat="duration"
              definedAxisTicks={2}
              stacked
              isLineChart
              tooltipFormatterOptions={{
                valueFormatter: value =>
                  tooltipFormatterUsingAggregateOutputType(value, 'duration'),
              }}
              errored={isError}
            />
          </MiniChartPanel>
        </ChartsContainerItem>
        <ChartsContainerItem>
          <MiniChartPanel title={t('Perceived Screen Load')}>
            <SubTitle>
              {READABLE_YAXIS_LABELS['avg(measurements.time_to_initial_display)']}
            </SubTitle>
            <Chart
              height={125}
              data={transformedSeries['avg(measurements.time_to_initial_display)']}
              loading={seriesIsLoading}
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '0',
              }}
              showLegend
              definedAxisTicks={2}
              isLineChart
              aggregateOutputFormat="duration"
              tooltipFormatterOptions={{
                valueFormatter: value =>
                  tooltipFormatterUsingAggregateOutputType(value, 'duration'),
              }}
              errored={isError}
            />

            <Spacer />
            <SubTitle>
              {READABLE_YAXIS_LABELS['avg(measurements.time_to_full_display)']}
            </SubTitle>
            <Chart
              height={125}
              data={transformedSeries['avg(measurements.time_to_full_display)']}
              loading={seriesIsLoading}
              showLegend
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '0',
              }}
              aggregateOutputFormat="duration"
              definedAxisTicks={2}
              stacked
              isLineChart
              tooltipFormatterOptions={{
                valueFormatter: value =>
                  tooltipFormatterUsingAggregateOutputType(value, 'duration'),
              }}
              errored={isError}
            />
          </MiniChartPanel>
        </ChartsContainerItem>
        <ChartsContainerItem>
          <MiniChartPanel title={t('Responsiveness')}>
            <SubTitle>
              {READABLE_YAXIS_LABELS['avg(measurements.frames_slow_rate)']}
            </SubTitle>
            <Chart
              height={125}
              data={transformedSeries['avg(measurements.frames_slow_rate)']}
              loading={seriesIsLoading}
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '0',
              }}
              showLegend
              definedAxisTicks={2}
              isLineChart
              aggregateOutputFormat="percentage"
              tooltipFormatterOptions={{
                valueFormatter: value =>
                  tooltipFormatterUsingAggregateOutputType(value, 'percentage'),
              }}
              errored={isError}
            />

            <Spacer />
            <SubTitle>
              {READABLE_YAXIS_LABELS['avg(measurements.frames_frozen_rate)']}
            </SubTitle>
            <Chart
              height={125}
              data={transformedSeries['avg(measurements.frames_frozen_rate)']}
              loading={seriesIsLoading}
              showLegend
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '0',
              }}
              aggregateOutputFormat="percentage"
              definedAxisTicks={2}
              stacked
              isLineChart
              tooltipFormatterOptions={{
                valueFormatter: value =>
                  tooltipFormatterUsingAggregateOutputType(value, 'percentage'),
              }}
              errored={isError}
            />
          </MiniChartPanel>
        </ChartsContainerItem>
      </Fragment>
    );
  }

  return (
    <div data-test-id="starfish-movile-view">
      <StyledRow minSize={300}>
        <ChartsContainer>{renderCharts()}</ChartsContainer>
      </StyledRow>
      <ViewsList />
    </div>
  );
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;

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

const SubTitle = styled('div')`
  margin-bottom: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
`;
