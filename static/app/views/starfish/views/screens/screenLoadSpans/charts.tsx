import {Fragment} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
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
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {
  CHART_TITLES,
  OUTPUT_TYPE,
  YAXIS_COLUMNS,
} from 'sentry/views/starfish/views/screens';

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

const DEVICE_CLASS_BREAKDOWN_INDEX = {
  high: 0,
  medium: 1,
  low: 2,
};

const EMPTY = '';
const UNKNOWN = 'unknown';
type Props = {
  yAxes: YAxis[];
  additionalFilters?: string[];
  chartHeight?: number;
};

export function ScreenCharts({yAxes, additionalFilters, chartHeight}: Props) {
  const pageFilter = usePageFilters();

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

  useSynchronizeCharts();
  const {
    isLoading: seriesIsLoading,
    data: releaseSeries,
    isError,
  } = useEventsStatsQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: ['release', 'device.class', ...yAxisCols],
        topEvents: '6',
        orderby: yAxisCols[0],
        yAxis: yAxisCols,
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
    referrer: 'api.starfish-web-service.span-category-breakdown-timeseries',
    initialData: {},
  });

  if (isReleasesLoading) {
    return <LoadingContainer />;
  }

  const transformedReleaseSeries: {
    [yAxisName: string]: {
      [releaseVersion: string]: {[deviceClass: string]: Series | undefined};
    };
  } = {};
  yAxes.forEach(val => {
    transformedReleaseSeries[YAXIS_COLUMNS[val]] = {};
    if (primaryRelease) {
      transformedReleaseSeries[YAXIS_COLUMNS[val]][primaryRelease] = {};
    }
    if (secondaryRelease) {
      transformedReleaseSeries[YAXIS_COLUMNS[val]][secondaryRelease] = {};
    }
  });

  function renderCharts() {
    if (defined(releaseSeries)) {
      Object.keys(releaseSeries).forEach(seriesName => {
        const [deviceClass, ...releaseArray] = seriesName.split(',');
        const index = DEVICE_CLASS_BREAKDOWN_INDEX[deviceClass] ?? 3;
        const release = releaseArray.join(',');
        const isPrimary = release === primaryRelease;

        if (release !== EMPTY) {
          Object.keys(releaseSeries[seriesName]).forEach(yAxis => {
            const label = `${deviceClass === EMPTY ? UNKNOWN : deviceClass}, ${release}`;
            if (yAxis in transformedReleaseSeries) {
              const data =
                releaseSeries[seriesName][yAxis]?.data.map(datum => {
                  return {
                    name: datum[0] * 1000,
                    value: datum[1][0].count,
                  } as SeriesDataUnit;
                }) ?? [];

              transformedReleaseSeries[yAxis][release][
                deviceClass === EMPTY ? UNKNOWN : deviceClass
              ] = {
                seriesName: label,
                color: isPrimary
                  ? CHART_PALETTE[5][index]
                  : Color(CHART_PALETTE[5][index]).lighten(0.5).string(),
                data,
              };
            }
          });
        }
      });
    }

    return (
      <Fragment>
        {yAxes.map((val, index) => {
          return (
            <ChartsContainerItem key={val}>
              <MiniChartPanel title={CHART_TITLES[val]}>
                <Chart
                  height={chartHeight ?? 180}
                  data={
                    ['high', 'medium', 'low', UNKNOWN]
                      .flatMap(deviceClass => {
                        return [primaryRelease, secondaryRelease].map(r => {
                          if (r) {
                            return transformedReleaseSeries[yAxisCols[index]][r][
                              deviceClass
                            ];
                          }
                          return null;
                        });
                      })
                      .filter(v => defined(v)) as Series[]
                  }
                  loading={seriesIsLoading}
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
                  aggregateOutputFormat={OUTPUT_TYPE[val]}
                  tooltipFormatterOptions={{
                    valueFormatter: value =>
                      tooltipFormatterUsingAggregateOutputType(value, OUTPUT_TYPE[val]),
                  }}
                  errored={isError}
                />
              </MiniChartPanel>
            </ChartsContainerItem>
          );
        })}
      </Fragment>
    );
  }

  return (
    <div data-test-id="starfish-mobile-view">
      <StyledRow minSize={200}>
        <ChartsContainer>{renderCharts()}</ChartsContainer>
      </StyledRow>
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
