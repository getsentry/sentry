import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence, NewQuery} from 'sentry/types/organization';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import EventView from 'sentry/utils/discover/eventView';
import {
  aggregateOutputType,
  parseFunction,
  prettifyParsedFunction,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {ConfidenceFooter} from 'sentry/views/explore/charts/confidenceFooter';
import ChartContextMenu from 'sentry/views/explore/components/chartContextMenu';
import {
  useExploreDataset,
  useExploreVisualizes,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
import Chart, {
  ChartType,
  useSynchronizeCharts,
} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import {CHART_HEIGHT} from 'sentry/views/insights/database/settings';

interface ExploreChartsProps {
  canUsePreviousResults: boolean;
  confidences: Confidence[];
  query: string;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

const exploreChartTypeOptions = [
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

  const extrapolationMetaResults = useExtrapolationMeta({
    dataset,
    query,
  });

  const previousTimeseriesResult = usePrevious(timeseriesResult);

  const getSeries = useCallback(
    (dedupedYAxes: string[], formattedYAxes: (string | undefined)[]) => {
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
          if (s.seriesName === yAxis) {
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

      const outputTypes = new Set(
        formattedYAxes.filter(Boolean).map(aggregateOutputType)
      );

      return {
        chartIcon: <IconGraph type={chartIcon} />,
        chartType: visualize.chartType,
        label: visualize.label,
        yAxes: visualize.yAxes,
        formattedYAxes,
        data,
        error,
        loading,
        outputTypes,
        confidence: confidences[index],
      };
    });
  }, [confidences, getSeries, visualizes]);

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
    <Fragment>
      {chartInfos.map((chartInfo, index) => {
        return (
          <ChartContainer key={index}>
            <ChartPanel>
              <ChartHeader>
                {shouldRenderLabel && <ChartLabel>{chartInfo.label}</ChartLabel>}
                <ChartTitle>
                  {chartInfo.formattedYAxes.filter(Boolean).join(', ')}
                </ChartTitle>
                <Tooltip
                  title={t('Type of chart displayed in this visualization (ex. line)')}
                >
                  <CompactSelect
                    triggerProps={{
                      icon: chartInfo.chartIcon,
                      borderless: true,
                      showChevron: false,
                      size: 'sm',
                    }}
                    value={chartInfo.chartType}
                    menuTitle="Type"
                    options={exploreChartTypeOptions}
                    onChange={option => handleChartTypeChange(option.value, index)}
                  />
                </Tooltip>
                <Tooltip
                  title={t('Time interval displayed in this visualization (ex. 5m)')}
                >
                  <CompactSelect
                    value={interval}
                    onChange={({value}) => setInterval(value)}
                    triggerProps={{
                      icon: <IconClock />,
                      borderless: true,
                      showChevron: false,
                      size: 'sm',
                    }}
                    menuTitle="Interval"
                    options={intervalOptions}
                  />
                </Tooltip>
                <ChartContextMenu
                  visualizeYAxes={chartInfo.yAxes}
                  query={query}
                  interval={interval}
                  visualizeIndex={index}
                />
              </ChartHeader>
              <Chart
                height={CHART_HEIGHT}
                grid={{
                  left: '0',
                  right: '0',
                  top: '32px', // make room to fit the legend above the chart
                  bottom: '0',
                }}
                legendFormatter={value => formatVersion(value)}
                legendOptions={{
                  itemGap: 24,
                  top: '4px',
                }}
                data={chartInfo.data}
                error={chartInfo.error}
                loading={chartInfo.loading}
                chartGroup={EXPLORE_CHART_GROUP}
                // TODO Abdullah: Make chart colors dynamic, with changing topN events count and overlay count.
                chartColors={CHART_PALETTE[TOP_EVENTS_LIMIT - 1]}
                type={chartInfo.chartType}
                aggregateOutputFormat={
                  chartInfo.outputTypes.size === 1
                    ? chartInfo.outputTypes.keys().next().value
                    : undefined
                }
                showLegend
              />
              {dataset === DiscoverDatasets.SPANS_EAP_RPC && (
                <ChartFooter>
                  <ConfidenceFooter
                    sampleCount={extrapolationMetaResults.data?.[0]?.['count_sample()']}
                    confidence={chartInfo.confidence}
                  />
                </ChartFooter>
              )}
            </ChartPanel>
          </ChartContainer>
        );
      })}
    </Fragment>
  );
}

export function useExtrapolationMeta({
  dataset,
  query,
}: {
  dataset: DiscoverDatasets;
  query: string;
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
    enabled: dataset === DiscoverDatasets.SPANS_EAP_RPC,
  });
}

const ChartContainer = styled('div')`
  display: grid;
  gap: 0;
  grid-template-columns: 1fr;
  margin-bottom: ${space(2)};
`;

const ChartHeader = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const ChartTitle = styled('div')`
  ${p => p.theme.text.cardTitle}
  line-height: 32px;
  flex: 1;
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

const ChartFooter = styled('div')`
  display: inline-block;
  margin-top: ${space(1.5)};
  margin-bottom: 0;
`;
