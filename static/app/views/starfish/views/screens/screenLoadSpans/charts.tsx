import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Alert from 'sentry/components/alert';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatVersion} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {
  CHART_TITLES,
  OUTPUT_TYPE,
  YAXIS_COLUMNS,
} from 'sentry/views/starfish/views/screens';
import {ScreensBarChart} from 'sentry/views/starfish/views/screens/screenBarChart';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

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

type Props = {
  yAxes: YAxis[];
  additionalFilters?: string[];
  chartHeight?: number;
};

export function ScreenCharts({yAxes, additionalFilters}: Props) {
  const pageFilter = usePageFilters();
  const location = useLocation();

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

  const {
    data: series,
    isLoading: isSeriesLoading,
    isError,
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

      Object.keys(series[release]).forEach(yAxis => {
        const label = release;
        if (yAxis in transformedReleaseSeries) {
          const data =
            series[release][yAxis]?.data.map(datum => {
              return {
                name: datum[0] * 1000,
                value: datum[1][0].count,
              } as SeriesDataUnit;
            }) ?? [];

          const color = isPrimary ? CHART_PALETTE[3][0] : CHART_PALETTE[3][1];
          transformedReleaseSeries[yAxis][release] = {
            seriesName: formatVersion(label),
            color,
            data,
          };
        }
      });
    });
  }

  const {data: deviceClassEvents, isLoading: isDeviceClassEventsLoading} = useTableQuery({
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
      <Alert type="warning" showIcon>
        {t('Invalid selection. Try a different release or date range.')}
      </Alert>
    );
  }

  const transformedEvents: {
    [yAxisName: string]: {
      [releaseVersion: string]: Series;
    };
  } = {};

  yAxes.forEach(val => {
    transformedEvents[YAXIS_COLUMNS[val]] = {};
    if (primaryRelease) {
      transformedEvents[YAXIS_COLUMNS[val]][primaryRelease] = {
        seriesName: primaryRelease,
        data: Array(['high', 'medium', 'low', 'Unknown'].length).fill(0),
      };
    }
    if (secondaryRelease) {
      transformedEvents[YAXIS_COLUMNS[val]][secondaryRelease] = {
        seriesName: secondaryRelease,
        data: Array(['high', 'medium', 'low', 'Unknown'].length).fill(0),
      };
    }
  });

  const deviceClassIndex = Object.fromEntries(
    ['high', 'medium', 'low', 'Unknown'].map((e, i) => [e, i])
  );

  if (defined(deviceClassEvents)) {
    deviceClassEvents.data?.forEach(row => {
      const deviceClass = row['device.class'];
      const index = deviceClassIndex[deviceClass];

      const release = row.release;
      const isPrimary = release === primaryRelease;
      yAxes.forEach(val => {
        if (transformedEvents[YAXIS_COLUMNS[val]][release]) {
          transformedEvents[YAXIS_COLUMNS[val]][release].data[index] = {
            name: deviceClass,
            value: row[YAXIS_COLUMNS[val]],
            itemStyle: {
              color: isPrimary ? CHART_PALETTE[3][0] : CHART_PALETTE[3][1],
            },
          } as SeriesDataUnit;
        }
      });
    });
  }

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
                      yAxis: YAXIS_COLUMNS[yAxes[0]],
                      series: Object.values(transformedEvents[YAXIS_COLUMNS[yAxes[0]]]),
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
                      transformedReleaseSeries[YAXIS_COLUMNS[yAxes[0]]]
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
                    isLineChart
                    aggregateOutputFormat={OUTPUT_TYPE[YAxis.TTID]}
                    tooltipFormatterOptions={{
                      valueFormatter: value =>
                        tooltipFormatterUsingAggregateOutputType(
                          value,
                          OUTPUT_TYPE[YAxis.TTID]
                        ),
                    }}
                    errored={isError}
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
                      yAxis: YAXIS_COLUMNS[yAxes[1]],
                      series: Object.values(transformedEvents[YAXIS_COLUMNS[yAxes[1]]]),
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
                      transformedReleaseSeries[YAXIS_COLUMNS[yAxes[1]]]
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
                    isLineChart
                    aggregateOutputFormat={OUTPUT_TYPE[YAxis.TTFD]}
                    tooltipFormatterOptions={{
                      valueFormatter: value =>
                        tooltipFormatterUsingAggregateOutputType(
                          value,
                          OUTPUT_TYPE[YAxis.TTFD]
                        ),
                    }}
                    errored={isError}
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
                data={Object.values(transformedReleaseSeries[YAXIS_COLUMNS[yAxes[2]]])}
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
                isLineChart
                aggregateOutputFormat={OUTPUT_TYPE[YAxis.COUNT]}
                tooltipFormatterOptions={{
                  valueFormatter: value =>
                    tooltipFormatterUsingAggregateOutputType(
                      value,
                      OUTPUT_TYPE[YAxis.COUNT]
                    ),
                }}
                errored={isError}
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
