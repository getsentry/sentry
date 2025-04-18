import {useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {isTimeSeriesOther} from 'sentry/utils/timeSeries/isTimeSeriesOther';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {WidgetExtrapolationFooter} from 'sentry/views/explore/charts/widgetExtrapolationFooter';
import ChartContextMenu from 'sentry/views/explore/components/chartContextMenu';
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {CHART_HEIGHT, INGESTION_DELAY} from 'sentry/views/explore/settings';
import {
  ChartType,
  useSynchronizeCharts,
} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface ExploreChartsProps {
  canUsePreviousResults: boolean;
  confidences: Confidence[];
  dataset: DiscoverDatasets;
  query: string;
  setVisualizes: (visualizes: Visualize[]) => void;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  visualizes: Visualize[];
  hideContextMenu?: boolean;
  samplingMode?: SamplingMode;
}

export const EXPLORE_CHART_TYPE_OPTIONS = [
  {
    value: ChartType.LINE,
    label: t('Line'),
  },
  {
    value: ChartType.AREA,
    label: t('Area'),
  },
  {
    value: ChartType.BAR,
    label: t('Bar'),
  },
];

export const EXPLORE_CHART_GROUP = 'explore-charts_group';

export function ExploreCharts({
  canUsePreviousResults,
  confidences,
  query,
  timeseriesResult,
  visualizes,
  setVisualizes,
  hideContextMenu,
  samplingMode,
  dataset,
}: ExploreChartsProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const [interval, setInterval, intervalOptions] = useChartInterval();
  const topEvents = useTopEvents();
  const isTopN = defined(topEvents) && topEvents > 0;

  const previousTimeseriesResult = usePrevious(timeseriesResult);

  const getSeries = useCallback(
    (dedupedYAxes: string[], formattedYAxes: Array<string | undefined>) => {
      const shouldUsePreviousResults =
        timeseriesResult.isPending &&
        canUsePreviousResults &&
        dedupedYAxes.every(yAxis => previousTimeseriesResult.data.hasOwnProperty(yAxis));

      const data = dedupedYAxes.flatMap((yAxis, i) => {
        const series = shouldUsePreviousResults
          ? previousTimeseriesResult.data[yAxis]
          : timeseriesResult.data[yAxis];

        return (series ?? []).map(s => {
          // We replace the series name with the formatted series name here
          // when possible as it's cleaner to read.
          //
          // We can't do this in top N mode as the series name uses the row
          // values instead of the aggregate function.
          if (s.field === yAxis) {
            return {
              ...s,
              seriesName: formattedYAxes[i] ?? yAxis,
            };
          }
          return s;
        });
      });

      return {
        data,
        error: shouldUsePreviousResults
          ? previousTimeseriesResult.error
          : timeseriesResult.error,
        loading: shouldUsePreviousResults
          ? previousTimeseriesResult.isPending
          : timeseriesResult.isPending,
      };
    },
    [canUsePreviousResults, timeseriesResult, previousTimeseriesResult]
  );

  const chartInfos = useMemo(() => {
    return visualizes.map((visualize, index) => {
      const dedupedYAxes = dedupeArray(visualize.yAxes);

      const formattedYAxes = dedupedYAxes.map(yaxis => {
        const func = parseFunction(yaxis);
        return func ? prettifyParsedFunction(func) : undefined;
      });

      const chartIcon =
        visualize.chartType === ChartType.LINE
          ? 'line'
          : visualize.chartType === ChartType.AREA
            ? 'area'
            : 'bar';

      const {data, error, loading} = getSeries(dedupedYAxes, formattedYAxes);

      const {sampleCount, isSampled, dataScanned} =
        determineSeriesSampleCountAndIsSampled(data, isTopN);

      return {
        chartIcon: <IconGraph type={chartIcon} />,
        chartType: visualize.chartType,
        label: visualize.label,
        yAxes: visualize.yAxes,
        formattedYAxes,
        data,
        error,
        loading,
        confidence: confidences[index],
        sampleCount,
        isSampled,
        dataScanned,
      };
    });
  }, [confidences, getSeries, visualizes, isTopN]);

  const handleChartTypeChange = useCallback(
    (chartType: ChartType, index: number) => {
      const newVisualizes = visualizes.slice();
      newVisualizes[index] = {...newVisualizes[index]!, chartType};
      setVisualizes(newVisualizes);
    },
    [visualizes, setVisualizes]
  );

  useSynchronizeCharts(
    visualizes.length,
    !timeseriesResult.isPending,
    EXPLORE_CHART_GROUP
  );

  const shouldRenderLabel = visualizes.length > 1;

  return (
    <ChartList>
      <WidgetSyncContextProvider>
        {chartInfos.map((chartInfo, index) => {
          const Title = (
            <ChartTitle>
              {shouldRenderLabel && <ChartLabel>{chartInfo.label}</ChartLabel>}
              <Widget.WidgetTitle
                title={chartInfo.formattedYAxes.filter(Boolean).join(', ')}
              />
            </ChartTitle>
          );

          if (chartInfo.loading) {
            return (
              <Widget
                key={index}
                height={CHART_HEIGHT}
                Title={Title}
                Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
                revealActions="always"
                Footer={
                  organization.features.includes(
                    'visibility-explore-progressive-loading'
                  ) && (
                    <WidgetExtrapolationFooter
                      samplingMode={undefined}
                      sampleCount={0}
                      isSampled={null}
                      confidence={undefined}
                      topEvents={undefined}
                      dataScanned={undefined}
                      dataset={dataset}
                    />
                  )
                }
              />
            );
          }

          if (chartInfo.error) {
            return (
              <Widget
                key={index}
                height={CHART_HEIGHT}
                Title={Title}
                Visualization={<Widget.WidgetError error={chartInfo.error} />}
                revealActions="always"
              />
            );
          }

          if (chartInfo.data.length === 0) {
            // This happens when the `/events-stats/` endpoint returns a blank
            // response. This is a rare error condition that happens when
            // proxying to RPC. Adding explicit handling with a "better" message
            return (
              <Widget
                key={index}
                height={CHART_HEIGHT}
                Title={Title}
                Visualization={<Widget.WidgetError error={t('No data')} />}
                revealActions="always"
              />
            );
          }

          const DataPlottableConstructor =
            chartInfo.chartType === ChartType.LINE
              ? Line
              : chartInfo.chartType === ChartType.AREA
                ? Area
                : Bars;

          return (
            <Widget
              key={index}
              height={CHART_HEIGHT}
              Title={Title}
              Actions={[
                <Tooltip
                  key="visualization"
                  title={t('Type of chart displayed in this visualization (ex. line)')}
                >
                  <CompactSelect
                    triggerProps={{
                      icon: chartInfo.chartIcon,
                      borderless: true,
                      showChevron: false,
                      size: 'xs',
                    }}
                    value={chartInfo.chartType}
                    menuTitle="Type"
                    options={EXPLORE_CHART_TYPE_OPTIONS}
                    onChange={option => handleChartTypeChange(option.value, index)}
                  />
                </Tooltip>,
                <Tooltip
                  key="interval"
                  title={t('Time interval displayed in this visualization (ex. 5m)')}
                >
                  <CompactSelect
                    value={interval}
                    onChange={({value}) => setInterval(value)}
                    triggerProps={{
                      icon: <IconClock />,
                      borderless: true,
                      showChevron: false,
                      size: 'xs',
                    }}
                    menuTitle="Interval"
                    options={intervalOptions}
                  />
                </Tooltip>,
                [
                  ...(hideContextMenu
                    ? []
                    : [
                        <ChartContextMenu
                          key="context"
                          visualizeYAxes={chartInfo.yAxes}
                          query={query}
                          interval={interval}
                          visualizeIndex={index}
                        />,
                      ]),
                ],
              ]}
              revealActions="always"
              Visualization={
                <TimeSeriesWidgetVisualization
                  plottables={chartInfo.data.map(timeSeries => {
                    return new DataPlottableConstructor(timeSeries, {
                      delay: INGESTION_DELAY,
                      color: isTimeSeriesOther(timeSeries) ? theme.chartOther : undefined,
                      stack: 'all',
                    });
                  })}
                  legendSelection={{
                    // disable the 'Other' series by default since its large values can cause the other lines to be insignificant
                    Other: false,
                  }}
                />
              }
              Footer={
                <WidgetExtrapolationFooter
                  sampleCount={chartInfo.sampleCount}
                  isSampled={chartInfo.isSampled}
                  confidence={chartInfo.confidence}
                  topEvents={
                    topEvents ? Math.min(topEvents, chartInfo.data.length) : undefined
                  }
                  dataScanned={chartInfo.dataScanned}
                  samplingMode={samplingMode}
                  dataset={dataset}
                />
              }
            />
          );
        })}
      </WidgetSyncContextProvider>
    </ChartList>
  );
}

const ChartList = styled('div')`
  display: grid;
  row-gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const ChartLabel = styled('div')`
  background-color: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  text-align: center;
  min-width: 24px;
  color: ${p => p.theme.purple400};
  white-space: nowrap;
  font-weight: ${p => p.theme.fontWeightBold};
  align-content: center;
  margin-right: ${space(1)};
`;

const ChartTitle = styled('div')`
  display: flex;
  margin-left: ${space(2)};
`;
