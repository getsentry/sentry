import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence, NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import EventView from 'sentry/utils/discover/eventView';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {determineSeriesSampleCount} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ConfidenceFooter} from 'sentry/views/explore/charts/confidenceFooter';
import ChartContextMenu from 'sentry/views/explore/components/chartContextMenu';
import {
  useExploreDataset,
  useExploreVisualizes,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {
  ChartType,
  useSynchronizeCharts,
} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

import {CHART_HEIGHT, INGESTION_DELAY} from '../settings';

interface ExploreChartsProps {
  canUsePreviousResults: boolean;
  confidences: Confidence[];
  query: string;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
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
}: ExploreChartsProps) {
  const dataset = useExploreDataset();
  const visualizes = useExploreVisualizes();
  const setVisualizes = useSetExploreVisualizes();
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

      const sampleCount = determineSeriesSampleCount(data, isTopN);

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
                <ChartContextMenu
                  key="context"
                  visualizeYAxes={chartInfo.yAxes}
                  query={query}
                  interval={interval}
                  visualizeIndex={index}
                />,
              ]}
              revealActions="always"
              Visualization={
                <TimeSeriesWidgetVisualization
                  dataCompletenessDelay={INGESTION_DELAY}
                  visualizationType={
                    chartInfo.chartType === ChartType.AREA
                      ? 'area'
                      : chartInfo.chartType === ChartType.LINE
                        ? 'line'
                        : 'bar'
                  }
                  timeSeries={chartInfo.data}
                />
              }
              Footer={
                dataset === DiscoverDatasets.SPANS_EAP_RPC && (
                  <ConfidenceFooter
                    sampleCount={chartInfo.sampleCount}
                    confidence={chartInfo.confidence}
                    topEvents={
                      topEvents ? Math.min(topEvents, chartInfo.data.length) : undefined
                    }
                  />
                )
              }
            />
          );
        })}
      </WidgetSyncContextProvider>
    </ChartList>
  );
}

export function useExtrapolationMeta({
  dataset,
  query,
  isAllowedSelection,
}: {
  dataset: DiscoverDatasets;
  query: string;
  isAllowedSelection?: boolean;
}) {
  const {selection} = usePageFilters();

  const extrapolationMetaEventView = useMemo(() => {
    const search = new MutableSearch(query);

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    search.addFilterValues('!transaction.span_id', ['00']);

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Extrapolation Meta',
      fields: ['count_sample()', 'min(sampling_rate)'],
      query: search.formatString(),
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, query, selection]);

  return useSpansQuery({
    eventView: extrapolationMetaEventView,
    initialData: [],
    referrer: 'api.explore.spans-extrapolation-meta',
    enabled:
      (defined(isAllowedSelection) ? isAllowedSelection : true) &&
      dataset === DiscoverDatasets.SPANS_EAP_RPC,
    trackResponseAnalytics: false,
  });
}

const ChartList = styled('div')`
  display: grid;
  row-gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const ChartLabel = styled('div')`
  background-color: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  text-align: center;
  min-width: 32px;
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
