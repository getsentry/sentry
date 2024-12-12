import type {Dispatch, SetStateAction} from 'react';
import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {CompactSelect} from 'sentry/components/compactSelect';
import Count from 'sentry/components/count';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconClock, IconGraph} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence, NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import EventView from 'sentry/utils/discover/eventView';
import {
  aggregateOutputType,
  parseFunction,
  prettifyParsedFunction,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import ChartContextMenu from 'sentry/views/explore/components/chartContextMenu';
import {
  useExploreDataset,
  useExploreGroupBys,
  useExploreMode,
  useExploreSortBys,
  useExploreVisualizes,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import Chart, {
  ChartType,
  useSynchronizeCharts,
} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import {CHART_HEIGHT} from 'sentry/views/insights/database/settings';

import {TOP_EVENTS_LIMIT, useTopEvents} from '../hooks/useTopEvents';

interface ExploreChartsProps {
  query: string;
  setConfidence: Dispatch<SetStateAction<Confidence>>;
  setError: Dispatch<SetStateAction<string>>;
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

export function ExploreCharts({query, setConfidence, setError}: ExploreChartsProps) {
  const dataset = useExploreDataset();
  const visualizes = useExploreVisualizes();
  const setVisualizes = useSetExploreVisualizes();
  const [interval, setInterval, intervalOptions] = useChartInterval();
  const groupBys = useExploreGroupBys();
  const mode = useExploreMode();
  const topEvents = useTopEvents();

  const extrapolationMetaResults = useExtrapolationMeta({
    dataset,
    query,
  });

  const fields: string[] = useMemo(() => {
    if (mode === Mode.SAMPLES) {
      return [];
    }

    return [...groupBys, ...visualizes.flatMap(visualize => visualize.yAxes)].filter(
      Boolean
    );
  }, [mode, groupBys, visualizes]);

  const sortBys = useExploreSortBys();

  const orderby: string | string[] | undefined = useMemo(() => {
    if (!sortBys.length) {
      return undefined;
    }

    return sortBys.map(formatSort);
  }, [sortBys]);

  const yAxes = useMemo(() => {
    const deduped = dedupeArray(visualizes.flatMap(visualize => visualize.yAxes));
    deduped.sort();
    return deduped;
  }, [visualizes]);

  const options = useMemo(() => {
    const search = new MutableSearch(query);

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    search.addFilterValues('!transaction.span_id', ['00']);

    return {
      search,
      yAxis: yAxes,
      interval,
      fields,
      orderby,
      topEvents,
    };
  }, [query, yAxes, interval, fields, orderby, topEvents]);

  const previousQuery = usePrevious(query);
  const previousOptions = usePrevious(options);
  const canUsePreviousResults = useMemo(() => {
    if (!isEqual(query, previousQuery)) {
      return false;
    }

    if (!isEqual(options.interval, previousOptions.interval)) {
      return false;
    }

    if (!isEqual(options.fields, previousOptions.fields)) {
      return false;
    }

    if (!isEqual(options.orderby, previousOptions.orderby)) {
      return false;
    }

    if (!isEqual(options.topEvents, previousOptions.topEvents)) {
      return false;
    }

    return true;
  }, [query, previousQuery, options, previousOptions]);

  const timeSeriesResult = useSortedTimeSeries(options, 'api.explorer.stats', dataset);
  const previousTimeSeriesResult = usePrevious(timeSeriesResult);

  const resultConfidence = useMemo(() => {
    if (dataset !== DiscoverDatasets.SPANS_EAP_RPC) {
      return null;
    }

    const {lowConfidence, highConfidence, nullConfidence} = Object.values(
      timeSeriesResult.data
    ).reduce(
      (acc, series) => {
        for (const s of series) {
          if (s.confidence === 'low') {
            acc.lowConfidence += 1;
          } else if (s.confidence === 'high') {
            acc.highConfidence += 1;
          } else {
            acc.nullConfidence += 1;
          }
        }
        return acc;
      },
      {lowConfidence: 0, highConfidence: 0, nullConfidence: 0}
    );

    if (lowConfidence <= 0 && highConfidence <= 0 && nullConfidence >= 0) {
      return null;
    }

    if (lowConfidence / (lowConfidence + highConfidence) > 0.5) {
      return 'low';
    }

    return 'high';
  }, [dataset, timeSeriesResult.data]);

  useEffect(() => {
    // only update the confidence once the result has loaded
    if (!timeSeriesResult.isPending) {
      setConfidence(resultConfidence);
    }
  }, [setConfidence, resultConfidence, timeSeriesResult.isPending]);

  useEffect(() => {
    setError(timeSeriesResult.error?.message ?? '');
  }, [setError, timeSeriesResult.error?.message]);

  const getSeries = useCallback(
    (dedupedYAxes: string[], formattedYAxes: (string | undefined)[]) => {
      const shouldUsePreviousResults =
        timeSeriesResult.isPending &&
        canUsePreviousResults &&
        dedupedYAxes.every(yAxis => previousTimeSeriesResult.data.hasOwnProperty(yAxis));

      const data = dedupedYAxes.flatMap((yAxis, i) => {
        const series = shouldUsePreviousResults
          ? previousTimeSeriesResult.data[yAxis]
          : timeSeriesResult.data[yAxis];

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
          ? previousTimeSeriesResult.error
          : timeSeriesResult.error,
        loading: shouldUsePreviousResults
          ? previousTimeSeriesResult.isPending
          : timeSeriesResult.isPending,
      };
    },
    [canUsePreviousResults, timeSeriesResult, previousTimeSeriesResult]
  );

  const handleChartTypeChange = useCallback(
    (chartType: ChartType, index: number) => {
      const newVisualizes = visualizes.slice();
      newVisualizes[index] = {...newVisualizes[index], chartType};
      setVisualizes(newVisualizes);
    },
    [visualizes, setVisualizes]
  );

  useSynchronizeCharts(
    visualizes.length,
    !timeSeriesResult.isPending,
    EXPLORE_CHART_GROUP
  );

  const shouldRenderLabel = visualizes.length > 1;

  return (
    <Fragment>
      {visualizes.map((visualize, index) => {
        const dedupedYAxes = dedupeArray(visualize.yAxes);

        const formattedYAxes = dedupedYAxes.map(yaxis => {
          const func = parseFunction(yaxis);
          return func ? prettifyParsedFunction(func) : undefined;
        });

        const {chartType, label, yAxes: visualizeYAxes} = visualize;
        const chartIcon =
          chartType === ChartType.LINE
            ? 'line'
            : chartType === ChartType.AREA
              ? 'area'
              : 'bar';

        const {data, error, loading} = getSeries(dedupedYAxes, formattedYAxes);

        const outputTypes = new Set(
          formattedYAxes.filter(Boolean).map(aggregateOutputType)
        );

        return (
          <ChartContainer key={index}>
            <ChartPanel>
              <ChartHeader>
                {shouldRenderLabel && <ChartLabel>{label}</ChartLabel>}
                <ChartTitle>{formattedYAxes.filter(Boolean).join(', ')}</ChartTitle>
                <Tooltip
                  title={t('Type of chart displayed in this visualization (ex. line)')}
                >
                  <CompactSelect
                    triggerProps={{
                      icon: <IconGraph type={chartIcon} />,
                      borderless: true,
                      showChevron: false,
                      size: 'sm',
                    }}
                    value={chartType}
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
                  visualizeYAxes={visualizeYAxes}
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
                  top: '8px',
                  bottom: '0',
                }}
                legendFormatter={value => formatVersion(value)}
                data={data}
                error={error}
                loading={loading}
                chartGroup={EXPLORE_CHART_GROUP}
                // TODO Abdullah: Make chart colors dynamic, with changing topN events count and overlay count.
                chartColors={CHART_PALETTE[TOP_EVENTS_LIMIT - 1]}
                type={chartType}
                aggregateOutputFormat={
                  outputTypes.size === 1 ? outputTypes.keys().next().value : undefined
                }
                showLegend
              />
              {dataset === DiscoverDatasets.SPANS_EAP_RPC && (
                <ChartFooter>
                  {defined(extrapolationMetaResults.data?.[0]?.['count_sample()']) &&
                  defined(
                    extrapolationMetaResults.data?.[0]?.['avg_sample(sampling_rate)']
                  )
                    ? tct(
                        '*[sampleCount] samples extrapolated with an average sampling rate of [sampleRate]',
                        {
                          sampleCount: (
                            <Count
                              value={extrapolationMetaResults.data[0]['count_sample()']}
                            />
                          ),
                          sampleRate: formatPercentage(
                            extrapolationMetaResults.data[0]['avg_sample(sampling_rate)']
                          ),
                        }
                      )
                    : t('foo')}
                </ChartFooter>
              )}
            </ChartPanel>
          </ChartContainer>
        );
      })}
    </Fragment>
  );
}

function useExtrapolationMeta({
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
      fields: ['count_sample()', 'avg_sample(sampling_rate)', 'min(sampling_rate)'],
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
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  display: inline-block;
  margin-top: ${space(1.5)};
  margin-bottom: 0;
`;
