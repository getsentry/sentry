import {Fragment} from 'react';
import styled from '@emotion/styled';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import withApi from 'sentry/utils/withApi';
import {P95_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleases} from 'sentry/views/starfish/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {ViewsList} from 'sentry/views/starfish/views/mobileServiceView/viewsList';
import {BaseStarfishViewProps} from 'sentry/views/starfish/views/webServiceView/starfishLanding';

const EventsRequest = withApi(_EventsRequest);

export function MobileStarfishView(props: BaseStarfishViewProps) {
  const {eventView, organization} = props;
  const pageFilter = usePageFilters();
  const location = useLocation();
  const {data: releases, isLoading: isReleasesLoading} = useReleases();

  useSynchronizeCharts();
  if (isReleasesLoading) {
    return <LoadingContainer />;
  }

  const release1 =
    decodeScalar(location.query.release1) ?? releases?.[0]?.version ?? undefined;

  const release2 =
    decodeScalar(location.query.release2) ?? releases?.[0]?.version ?? undefined;

  const releaseFilter: string[] = [];
  if (defined(release1) && release1 !== '') {
    releaseFilter.push(release1);
  }

  if (defined(release2) && release2 !== '' && release1 !== release2) {
    releaseFilter.push(release2);
  }

  function renderCharts() {
    const query = new MutableSearch(['event.type:transaction', 'transaction.op:ui.load']);

    if (releaseFilter.length > 0) {
      query.addStringFilter(`release:[${releaseFilter.join(',')}]`);
    }

    return (
      <EventsRequest
        query={query.formatString()}
        includePrevious={false}
        partial
        interval={getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        )}
        includeTransformedData
        limit={1}
        environment={eventView.environment}
        project={eventView.project}
        period={eventView.statsPeriod}
        referrer="api.starfish-mobile-service.homepage-charts"
        start={eventView.start}
        end={eventView.end}
        organization={organization}
        yAxis={[
          'avg(measurements.app_start_cold)',
          'avg(measurements.app_start_warm)',
          'avg(measurements.time_to_initial_display)',
          'avg(measurements.time_to_full_display)',
          'avg(measurements.frames_slow_rate)',
          'avg(measurements.frames_frozen_rate)',
        ]}
        dataset={DiscoverDatasets.METRICS}
      >
        {({loading, results}) => {
          if (!results || !results[0] || !results[1]) {
            return null;
          }

          const coldStart: Series = {
            seriesName: 'avg(app_start_cold)',
            data: results[0].data,
          };

          const warmStart: Series = {
            seriesName: 'avg(app_start_warm)',
            data: results[1].data,
          };

          const initialDisplay: Series = {
            seriesName: 'avg(time_to_initial_display)',
            data: results[2].data,
          };

          const fullDisplay: Series = {
            seriesName: 'avg(time_to_full_display)',
            data: results[3].data,
          };

          const slowFrames: Series = {
            seriesName: 'avg(slow_frames_rate)',
            data: results[4].data,
          };

          const frozenFrames: Series = {
            seriesName: 'avg(frozen_frames_rate)',
            data: results[5].data,
          };

          return (
            <Fragment>
              <ChartsContainerItem>
                <MiniChartPanel title={t('App Initialization')}>
                  <Chart
                    statsPeriod={eventView.statsPeriod}
                    height={125}
                    data={[coldStart]}
                    start={eventView.start as string}
                    end={eventView.end as string}
                    loading={loading}
                    utc={false}
                    grid={{
                      left: '0',
                      right: '0',
                      top: '16px',
                      bottom: '0',
                    }}
                    showLegend
                    definedAxisTicks={2}
                    isLineChart
                    chartColors={[P95_COLOR]}
                    aggregateOutputFormat="duration"
                    tooltipFormatterOptions={{
                      valueFormatter: value =>
                        tooltipFormatterUsingAggregateOutputType(value, 'duration'),
                    }}
                  />

                  <Spacer />

                  <Chart
                    statsPeriod={eventView.statsPeriod}
                    height={125}
                    data={[warmStart]}
                    start=""
                    end=""
                    loading={loading}
                    showLegend
                    utc={false}
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
                    chartColors={[THROUGHPUT_COLOR]}
                    tooltipFormatterOptions={{
                      valueFormatter: value =>
                        tooltipFormatterUsingAggregateOutputType(value, 'duration'),
                    }}
                  />
                </MiniChartPanel>
              </ChartsContainerItem>
              <ChartsContainerItem>
                <MiniChartPanel title={t('Perceived Page Load')}>
                  <Chart
                    statsPeriod={eventView.statsPeriod}
                    height={125}
                    data={[initialDisplay]}
                    start={eventView.start as string}
                    end={eventView.end as string}
                    loading={loading}
                    utc={false}
                    grid={{
                      left: '0',
                      right: '0',
                      top: '16px',
                      bottom: '0',
                    }}
                    showLegend
                    definedAxisTicks={2}
                    isLineChart
                    chartColors={[P95_COLOR]}
                    aggregateOutputFormat="duration"
                    tooltipFormatterOptions={{
                      valueFormatter: value =>
                        tooltipFormatterUsingAggregateOutputType(value, 'duration'),
                    }}
                  />

                  <Spacer />

                  <Chart
                    statsPeriod={eventView.statsPeriod}
                    height={125}
                    data={[fullDisplay]}
                    start=""
                    end=""
                    loading={loading}
                    showLegend
                    utc={false}
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
                    chartColors={[THROUGHPUT_COLOR]}
                    tooltipFormatterOptions={{
                      valueFormatter: value =>
                        tooltipFormatterUsingAggregateOutputType(value, 'duration'),
                    }}
                  />
                </MiniChartPanel>
              </ChartsContainerItem>
              <ChartsContainerItem>
                <MiniChartPanel title={t('Responsiveness')}>
                  <Chart
                    statsPeriod={eventView.statsPeriod}
                    height={125}
                    data={[slowFrames]}
                    start={eventView.start as string}
                    end={eventView.end as string}
                    loading={loading}
                    utc={false}
                    grid={{
                      left: '0',
                      right: '0',
                      top: '16px',
                      bottom: '0',
                    }}
                    showLegend
                    definedAxisTicks={2}
                    isLineChart
                    chartColors={[P95_COLOR]}
                    aggregateOutputFormat="percentage"
                    tooltipFormatterOptions={{
                      valueFormatter: value =>
                        tooltipFormatterUsingAggregateOutputType(value, 'percentage'),
                    }}
                  />

                  <Spacer />

                  <Chart
                    statsPeriod={eventView.statsPeriod}
                    height={125}
                    data={[frozenFrames]}
                    start=""
                    end=""
                    loading={loading}
                    showLegend
                    utc={false}
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
                    chartColors={[THROUGHPUT_COLOR]}
                    tooltipFormatterOptions={{
                      valueFormatter: value =>
                        tooltipFormatterUsingAggregateOutputType(value, 'percentage'),
                    }}
                  />
                </MiniChartPanel>
              </ChartsContainerItem>
            </Fragment>
          );
        }}
      </EventsRequest>
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
