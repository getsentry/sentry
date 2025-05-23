import {Fragment, useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/core/alert';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import MiniChartPanel from 'sentry/views/insights/common/components/miniChartPanel';
import {useMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {useTopNMetricsMultiSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverMultiSeries';
import {formatVersionAndCenterTruncate} from 'sentry/views/insights/common/utils/centerTruncate';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {ScreensBarChart} from 'sentry/views/insights/mobile/screenload/components/charts/screenBarChart';
import {
  CHART_TITLES,
  OUTPUT_TYPE,
  YAXIS_COLUMNS,
} from 'sentry/views/insights/mobile/screenload/constants';
import {transformDeviceClassEvents} from 'sentry/views/insights/mobile/screenload/utils';

enum YAxis {
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
  additionalFilters?: string[];
  chartHeight?: number;
};

const yAxes = [YAxis.TTID, YAxis.TTFD, YAxis.COUNT];

export function ScreenCharts({additionalFilters}: Props) {
  const useEap = useInsightsEap();
  const theme = useTheme();
  const {isProjectCrossPlatform, selectedPlatform: platform} = useCrossPlatformProject();
  const yAxisCols = [
    'avg(measurements.time_to_initial_display)',
    'avg(measurements.time_to_full_display)',
    'count()',
  ] as const;

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const queryString = useMemo(() => {
    const query = new MutableSearch([
      useEap ? 'is_transaction:true' : 'event.type:transaction',
      'transaction.op:ui.load',
      ...(additionalFilters ?? []),
    ]);

    if (isProjectCrossPlatform) {
      query.addFilterValue('os.name', platform);
    }

    if (useEap) {
      query.addFilterValue('is_transaction', 'true');
    }

    return appendReleaseFilters(query, primaryRelease, secondaryRelease);
  }, [
    additionalFilters,
    isProjectCrossPlatform,
    platform,
    primaryRelease,
    secondaryRelease,
    useEap,
  ]);

  const {
    data: releaseSeriesArray,
    isPending: isSeriesLoading,
    error: seriesError,
  } = useTopNMetricsMultiSeries(
    {
      fields: ['release'],
      topN: 2,
      yAxis: [
        'avg(measurements.time_to_initial_display)',
        'avg(measurements.time_to_full_display)',
        'count()',
      ],
      search: queryString,
    },
    'api.starfish.mobile-screen-series'
  );

  useEffect(() => {
    if (defined(primaryRelease) || isReleasesLoading) {
      return;
    }
    Sentry.captureException(new Error('Screen summary missing releases'));
  }, [primaryRelease, isReleasesLoading]);

  const transformedReleaseSeries: Record<string, Record<string, Series>> = {};
  yAxes.forEach(val => {
    transformedReleaseSeries[YAXIS_COLUMNS[val]] = {};
  });

  const ttidSeries: Series[] = [];
  const ttfdSeries: Series[] = [];
  const countSeries: Series[] = [];

  if (defined(releaseSeriesArray)) {
    releaseSeriesArray.forEach(release => {
      const releaseName = release.name;
      const isPrimary = releaseName === primaryRelease;
      const colors = theme.chart.getColorPalette(3);
      const color = isPrimary ? colors[0] : colors[1];
      ttidSeries.push({
        ...release.data['avg(measurements.time_to_initial_display)'],
        color,
        seriesName: formatVersion(releaseName, true),
      });
      ttfdSeries.push({
        ...release.data['avg(measurements.time_to_full_display)'],
        color,
        seriesName: formatVersion(releaseName, true),
      });
      countSeries.push({
        ...release.data['count()'],
        color,
        seriesName: formatVersion(releaseName, true),
      });
    });
  }

  const {data: deviceClassEvents, isPending: isDeviceClassEventsLoading} = useMetrics(
    {
      enabled: !isReleasesLoading,
      search: queryString,
      orderby: yAxisCols[0],
      fields: ['device.class', 'release', ...yAxisCols],
    },
    'api.starfish.mobile-device-breakdown'
  );

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
    theme,
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
                    data={ttidSeries}
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
                    data={ttfdSeries}
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
                data={countSeries}
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

const Container = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-column-gap: ${space(2)};
`;
