import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import {Alert} from 'sentry/components/core/alert/alert';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import MiniChartPanel from 'sentry/views/insights/common/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/insights/common/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/insights/common/utils/constants';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useEventsStatsQuery} from 'sentry/views/insights/common/utils/useEventsStatsQuery';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {ScreensBarChart} from 'sentry/views/insights/mobile/screenload/components/charts/screenBarChart';
import {useTableQuery} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';
import {
  CHART_TITLES,
  OUTPUT_TYPE,
  YAXIS_COLUMNS,
} from 'sentry/views/insights/mobile/screenload/constants';
import {transformDeviceClassEvents} from 'sentry/views/insights/mobile/screenload/utils';

export enum YAxis {
  WARM_START = 0,
  COLD_START = 1,
  TTID = 2,
  TTFD = 3,
  SLOW_FRAME_RATE = 4,
  FROZEN_FRAME_RATE = 5,
  THROUGHPUT = 6,
  COUNT = 7,
}

type Props = {
  yAxes: YAxis[];
  additionalFilters?: string[];
  chartHeight?: number;
};

export function ScreenCharts({yAxes, additionalFilters}: Props) {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const {isProjectCrossPlatform, selectedPlatform: platform} = useCrossPlatformProject();

  const yAxisCols = yAxes.map(val => YAXIS_COLUMNS[val]);

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const queryString = useMemo(() => {
    const query = new MutableSearch([
      'event.type:transaction',
      'transaction.op:ui.load',
      ...(additionalFilters ?? []),
    ]);

    if (isProjectCrossPlatform) {
      query.addFilterValue('os.name', platform);
    }

    return appendReleaseFilters(query, primaryRelease, secondaryRelease);
  }, [
    additionalFilters,
    isProjectCrossPlatform,
    platform,
    primaryRelease,
    secondaryRelease,
  ]);

  const {
    data: series,
    isPending: isSeriesLoading,
    error: seriesError,
  } = useEventsStatsQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: ['release', ...yAxisCols],
        topEvents: '2',
        yAxis: [...yAxisCols],
        query: queryString,
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
    // TODO: Change referrer
    referrer: 'api.starfish.mobile-screen-series',
    initialData: {},
  });

  useEffect(() => {
    if (defined(primaryRelease) || isReleasesLoading) {
      return;
    }
    Sentry.captureException(new Error('Screen summary missing releases'));
  }, [primaryRelease, isReleasesLoading]);

  const transformedReleaseSeries: {
    [yAxisName: string]: {
      [releaseVersion: string]: Series;
    };
  } = {};
  yAxes.forEach(val => {
    transformedReleaseSeries[YAXIS_COLUMNS[val]] = {};
  });

  if (defined(series)) {
    Object.keys(series).forEach(release => {
      const isPrimary = release === primaryRelease;

      Object.keys(series[release]!).forEach(yAxis => {
        const label = release;
        if (yAxis in transformedReleaseSeries) {
          const data =
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            series[release]![yAxis]?.data.map((datum: any) => {
              return {
                name: datum[0] * 1000,
                value: datum[1][0].count,
              } as SeriesDataUnit;
            }) ?? [];

          const color = isPrimary ? CHART_PALETTE[3][0] : CHART_PALETTE[3][1];
          transformedReleaseSeries[yAxis]![release] = {
            seriesName: formatVersion(label, true),
            color,
            data,
          };
        }
      });
    });
  }

  const {data: deviceClassEvents, isPending: isDeviceClassEventsLoading} = useTableQuery({
    eventView: EventView.fromNewQueryWithLocation(
      {
        name: '',
        fields: ['device.class', 'release', ...yAxisCols],
        orderby: yAxisCols[0],
        yAxis: yAxisCols,
        query: queryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
      },
      location
    ),
    enabled: !isReleasesLoading,
    referrer: 'api.starfish.mobile-device-breakdown',
  });

  if (isReleasesLoading) {
    return <LoadingContainer />;
  }

  if (!defined(primaryRelease) && !isReleasesLoading) {
    return (
      <Alert.Container>
        <Alert type="warning" showIcon>
          {t('Invalid selection. Try a different release or date range.')}
        </Alert>
      </Alert.Container>
    );
  }

  const transformedEvents = transformDeviceClassEvents({
    yAxes,
    primaryRelease,
    secondaryRelease,
    data: deviceClassEvents,
  });

  function renderCharts() {
    return (
      <Fragment>
        <Container>
          <div>
            <StyledRow>
              <ChartsContainerItem key="deviceClass">
                <ScreensBarChart
                  chartOptions={[
                    {
                      title: t('TTID by Device Class'),
                      yAxis: YAXIS_COLUMNS[yAxes[0]!],
                      series: Object.values(transformedEvents[YAXIS_COLUMNS[yAxes[0]!]]!),
                      xAxisLabel: ['high', 'medium', 'low', 'Unknown'],
                      subtitle: primaryRelease
                        ? t(
                            '%s v. %s',
                            formatVersionAndCenterTruncate(primaryRelease, 12),
                            secondaryRelease
                              ? formatVersionAndCenterTruncate(secondaryRelease, 12)
                              : ''
                          )
                        : '',
                    },
                  ]}
                  chartKey="spansChart"
                  chartHeight={80}
                  isLoading={isDeviceClassEventsLoading}
                />
              </ChartsContainerItem>
              <ChartsContainerItem key="xyz">
                <MiniChartPanel
                  title={t('Average TTID')}
                  subtitle={
                    primaryRelease
                      ? t(
                          '%s v. %s',
                          formatVersionAndCenterTruncate(primaryRelease, 12),
                          secondaryRelease
                            ? formatVersionAndCenterTruncate(secondaryRelease, 12)
                            : ''
                        )
                      : ''
                  }
                >
                  <Chart
                    height={80}
                    data={Object.values(
                      transformedReleaseSeries[YAXIS_COLUMNS[yAxes[0]!]]!
                    )}
                    loading={isSeriesLoading}
                    grid={{
                      left: '0',
                      right: '0',
                      top: '8px',
                      bottom: '0',
                    }}
                    showLegend
                    definedAxisTicks={2}
                    type={ChartType.LINE}
                    aggregateOutputFormat={OUTPUT_TYPE[YAxis.TTID]}
                    tooltipFormatterOptions={{
                      valueFormatter: value =>
                        tooltipFormatterUsingAggregateOutputType(
                          value,
                          OUTPUT_TYPE[YAxis.TTID]
                        ),
                    }}
                    error={seriesError}
                  />
                </MiniChartPanel>
              </ChartsContainerItem>
            </StyledRow>
            <StyledRow>
              <ChartsContainerItem key="deviceClass">
                <ScreensBarChart
                  chartOptions={[
                    {
                      title: t('TTFD by Device Class'),
                      yAxis: YAXIS_COLUMNS[yAxes[1]!],
                      series: Object.values(transformedEvents[YAXIS_COLUMNS[yAxes[1]!]]!),
                      xAxisLabel: ['high', 'medium', 'low', 'Unknown'],
                      subtitle: primaryRelease
                        ? t(
                            '%s v. %s',
                            formatVersionAndCenterTruncate(primaryRelease, 12),
                            secondaryRelease
                              ? formatVersionAndCenterTruncate(secondaryRelease, 12)
                              : ''
                          )
                        : '',
                    },
                  ]}
                  chartKey="spansChart"
                  chartHeight={80}
                  isLoading={isDeviceClassEventsLoading}
                />
              </ChartsContainerItem>
              <ChartsContainerItem key="xyz">
                <MiniChartPanel
                  title={t('Average TTFD')}
                  subtitle={
                    primaryRelease
                      ? t(
                          '%s v. %s',
                          formatVersionAndCenterTruncate(primaryRelease, 12),
                          secondaryRelease
                            ? formatVersionAndCenterTruncate(secondaryRelease, 12)
                            : ''
                        )
                      : ''
                  }
                >
                  <Chart
                    height={80}
                    data={Object.values(
                      transformedReleaseSeries[YAXIS_COLUMNS[yAxes[1]!]]!
                    )}
                    loading={isSeriesLoading}
                    grid={{
                      left: '0',
                      right: '0',
                      top: '8px',
                      bottom: '0',
                    }}
                    showLegend
                    definedAxisTicks={2}
                    type={ChartType.LINE}
                    aggregateOutputFormat={OUTPUT_TYPE[YAxis.TTFD]}
                    tooltipFormatterOptions={{
                      valueFormatter: value =>
                        tooltipFormatterUsingAggregateOutputType(
                          value,
                          OUTPUT_TYPE[YAxis.TTFD]
                        ),
                    }}
                    error={seriesError}
                  />
                </MiniChartPanel>
              </ChartsContainerItem>
            </StyledRow>
          </div>
          <ChartsContainerItem key="xyz">
            <MiniChartPanel
              title={CHART_TITLES[YAxis.COUNT]}
              subtitle={
                primaryRelease
                  ? t(
                      '%s v. %s',
                      formatVersionAndCenterTruncate(primaryRelease, 12),
                      secondaryRelease
                        ? formatVersionAndCenterTruncate(secondaryRelease, 12)
                        : ''
                    )
                  : ''
              }
            >
              <Chart
                data={Object.values(transformedReleaseSeries[YAXIS_COLUMNS[yAxes[2]!]]!)}
                height={245}
                loading={isSeriesLoading}
                grid={{
                  left: '0',
                  right: '0',
                  top: '8px',
                  bottom: '0',
                }}
                showLegend
                definedAxisTicks={2}
                type={ChartType.LINE}
                aggregateOutputFormat={OUTPUT_TYPE[YAxis.COUNT]}
                tooltipFormatterOptions={{
                  valueFormatter: value =>
                    tooltipFormatterUsingAggregateOutputType(
                      value,
                      OUTPUT_TYPE[YAxis.COUNT]
                    ),
                }}
                error={seriesError}
              />
            </MiniChartPanel>
          </ChartsContainerItem>
        </Container>
      </Fragment>
    );
  }

  return <div data-test-id="starfish-mobile-view">{renderCharts()}</div>;
}

const StyledRow = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-column-gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;

export const Spacer = styled('div')`
  margin-top: ${space(3)};
`;

const Container = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-column-gap: ${space(2)};
`;
