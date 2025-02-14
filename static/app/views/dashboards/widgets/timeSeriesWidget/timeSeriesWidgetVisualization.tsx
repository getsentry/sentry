import {useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import type {
  BarSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  LineSeriesOption,
} from 'echarts';
import type {
  TooltipFormatterCallback,
  TopLevelFormatterParams,
} from 'echarts/types/dist/shared';
import type EChartsReactCore from 'echarts-for-react/lib/core';

import BaseChart from 'sentry/components/charts/baseChart';
import {getFormatter} from 'sentry/components/charts/components/tooltip';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {uniq} from 'sentry/utils/array/uniq';
import type {
  AggregationOutputType,
  DurationUnit,
  RateUnit,
  SizeUnit,
} from 'sentry/utils/discover/fields';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {useWidgetSyncContext} from '../../contexts/widgetSyncContext';
import type {Aliases, Release, TimeSeries, TimeseriesSelection} from '../common/types';

import {BarChartWidgetSeries} from './seriesConstructors/barChartWidgetSeries';
import {CompleteAreaChartWidgetSeries} from './seriesConstructors/completeAreaChartWidgetSeries';
import {CompleteLineChartWidgetSeries} from './seriesConstructors/completeLineChartWidgetSeries';
import {IncompleteAreaChartWidgetSeries} from './seriesConstructors/incompleteAreaChartWidgetSeries';
import {IncompleteLineChartWidgetSeries} from './seriesConstructors/incompleteLineChartWidgetSeries';
import {formatTooltipValue} from './formatTooltipValue';
import {formatYAxisValue} from './formatYAxisValue';
import {markDelayedData} from './markDelayedData';
import {ReleaseSeries} from './releaseSeries';
import {scaleTimeSeriesData} from './scaleTimeSeriesData';
import {FALLBACK_TYPE, FALLBACK_UNIT_FOR_FIELD_TYPE} from './settings';
import {splitSeriesIntoCompleteAndIncomplete} from './splitSeriesIntoCompleteAndIncomplete';

type VisualizationType = 'area' | 'line' | 'bar';

export interface TimeSeriesWidgetVisualizationProps {
  timeSeries: TimeSeries[];
  visualizationType: VisualizationType;
  aliases?: Aliases;
  dataCompletenessDelay?: number;
  onTimeseriesSelectionChange?: (selection: TimeseriesSelection) => void;
  releases?: Release[];
  stacked?: boolean;
  timeseriesSelection?: TimeseriesSelection;
}

const RELEASE_BUBBLE_SIZE = 12; // TODO: find a proper size

/**
 * Renders release bubbles underneath the main chart
 */
const renderReleaseBubble: CustomSeriesRenderItem = (
  _params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI
) => {
  const start = api.coord([api.value(0), 0]);
  const end = api.coord([api.value(2), api.value(1)]);

  const width = end[0]! - start[0]!;
  const shape = {
    x: start[0],
    y: start[1]! + 2,
    width,
    height: RELEASE_BUBBLE_SIZE - 4,
    r: 2,
  };

  return {
    type: 'rect',
    transition: ['shape'],
    shape,
    style: {
      fill: '#444674', // @TODO figure out proper colors
      // @TODO figure out correct opacity calculations
      opacity: api.value(1) * 0.1,
    },
    emphasis: {
      style: {
        stroke: '#000', // @TODO styling
      },
    },
  } as CustomSeriesRenderItemReturn;
};

export function TimeSeriesWidgetVisualization(props: TimeSeriesWidgetVisualizationProps) {
  const chartRef = useRef<EChartsReactCore | null>(null);
  const {register: registerWithWidgetSyncContext} = useWidgetSyncContext();

  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;

  const dataCompletenessDelay = props.dataCompletenessDelay ?? 0;

  const theme = useTheme();
  const organization = useOrganization();
  const navigate = useNavigate();

  const releaseSeries: Series | undefined = undefined;
  if (props.releases) {
    const onClick = (release: Release) => {
      navigate(
        normalizeUrl({
          pathname: `/organizations/${
            organization.slug
          }/releases/${encodeURIComponent(release.version)}/`,
        })
      );
    };

    // releaseSeries = ReleaseSeries(theme, props.releases, onClick, utc ?? false);
  }

  const formatSeriesName: (string: string) => string = name => {
    return props.aliases?.[name] ?? name;
  };

  const chartZoomProps = useChartZoom({
    saveOnZoom: true,
  });

  // TODO: The `meta.fields` property should be typed as
  // Record<string, AggregationOutputType | null>, which is the reality
  let yAxisFieldType: AggregationOutputType;

  const types = uniq(
    props.timeSeries.map(timeserie => {
      return timeserie?.meta?.fields?.[timeserie.field];
    })
  ).filter(Boolean) as AggregationOutputType[];

  if (types.length === 1) {
    // All timeseries have the same type. Use that as the Y axis type.
    yAxisFieldType = types[0]!;
  } else {
    // Types are mismatched or missing. Use a fallback type
    yAxisFieldType = FALLBACK_TYPE;
  }

  let yAxisUnit: DurationUnit | SizeUnit | RateUnit | null;

  const units = uniq(
    props.timeSeries.map(timeserie => {
      return timeserie?.meta?.units?.[timeserie.field];
    })
  ) as Array<DurationUnit | SizeUnit | RateUnit | null>;

  if (units.length === 1) {
    // All timeseries have the same unit. Use that unit. This is especially
    // important for named rate timeseries like `"epm()"` where the user would
    // expect a plot in minutes
    yAxisUnit = units[0]!;
  } else {
    // None of the series specified a unit, or there are mismatched units. Fall
    // back to an appropriate unit for the axis type
    yAxisUnit = FALLBACK_UNIT_FOR_FIELD_TYPE[yAxisFieldType];
  }

  // Apply unit scaling to all series
  const scaledSeries = props.timeSeries.map(timeserie => {
    return scaleTimeSeriesData(timeserie, yAxisUnit);
  });

  // Mark which points in the series are incomplete according to delay
  const markedSeries = scaledSeries.map(timeSeries =>
    markDelayedData(timeSeries, dataCompletenessDelay)
  );

  // Convert time series into plottable ECharts series
  const plottableSeries: Array<LineSeriesOption | BarSeriesOption> = [];

  // TODO: This is a little heavy, and probably worth memoizing
  if (props.visualizationType === 'bar') {
    // For bar charts, convert straight from time series to series, which will
    // automatically mark "delayed" bars
    markedSeries.forEach(timeSeries => {
      plottableSeries.push(
        BarChartWidgetSeries(timeSeries, props.stacked ? GLOBAL_STACK_NAME : undefined)
      );
    });
  } else {
    // For line and area charts, split each time series into two series, each
    // with corresponding styling. In an upcoming version of ECharts it'll be
    // possible to avoid this, and construct a single series
    markedSeries.forEach(timeSeries => {
      const [completeTimeSeries, incompleteTimeSeries] =
        splitSeriesIntoCompleteAndIncomplete(timeSeries, dataCompletenessDelay);

      if (completeTimeSeries) {
        plottableSeries.push(
          (props.visualizationType === 'area'
            ? CompleteAreaChartWidgetSeries
            : CompleteLineChartWidgetSeries)(completeTimeSeries)
        );
      }

      if (incompleteTimeSeries) {
        plottableSeries.push(
          (props.visualizationType === 'area'
            ? IncompleteAreaChartWidgetSeries
            : IncompleteLineChartWidgetSeries)(incompleteTimeSeries)
        );
      }
    });
  }

  const formatTooltip: TooltipFormatterCallback<TopLevelFormatterParams> = (
    params,
    asyncTicket
  ) => {
    // Only show the tooltip of the current chart. Otherwise, all tooltips
    // in the chart group appear.
    if (!isChartHovered(chartRef?.current)) {
      return '';
    }

    let deDupedParams = params;

    if (Array.isArray(params)) {
      // We split each series into a complete and incomplete series, and they
      // have the same name. The two series overlap at one point on the chart,
      // to create a continuous line. This code prevents both series from
      // showing up on the tooltip
      const uniqueSeries = new Set<string>();

      deDupedParams = params.filter(param => {
        // Filter null values from tooltip
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if (param.value[1] === null) {
          return false;
        }

        // @ts-expect-error TS(2345): Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
        if (uniqueSeries.has(param.seriesName)) {
          return false;
        }

        // @ts-expect-error TS(2345): Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
        uniqueSeries.add(param.seriesName);
        return true;
      });
    }

    return getFormatter({
      isGroupedByDate: true,
      showTimeInTooltip: true,
      valueFormatter: (value, field) => {
        if (!field) {
          return formatTooltipValue(value, FALLBACK_TYPE);
        }

        const timeserie = scaledSeries.find(t => t.field === field);

        return formatTooltipValue(
          value,
          timeserie?.meta?.fields?.[field] ?? FALLBACK_TYPE,
          timeserie?.meta?.units?.[field] ?? undefined
        );
      },
      nameFormatter: formatSeriesName,
      truncate: true,
      utc: utc ?? false,
    })(deDupedParams, asyncTicket);
  };

  let visibleSeriesCount = scaledSeries.length;
  if (releaseSeries) {
    visibleSeriesCount += 1;
  }

  const showLegend = visibleSeriesCount > 1;

  const buckets = [];
  if (props.releases?.length) {
    // we need to create release buckets using the time intervals specified in `timeseries`
    // assume that all timeseries will be equal in length, if not we'll need to search all timeseries
    const {data} = props.timeSeries[0];

    const MAGIC_INTERVAL = 30; // @TODO figure out how to calculate the magic interval
    let releaseIterator = props.releases.length - 1;

    for (let i = 0; i < data.length; i += MAGIC_INTERVAL) {
      const start = new Date(data[i].timestamp);
      const end = new Date(data[Math.min(i + MAGIC_INTERVAL, data.length - 1)].timestamp);

      const releasesInBucket = [];

      // For my test data, props.releases is in descending order, whereas `timeSeries` is ascending
      // We probably should ensure it's sorted and order it ascending
      for (let j = releaseIterator; j >= 0; j--) {
        const releaseTs = new Date(props.releases[j]?.timestamp);

        // If release timestamp is within bounds of the current bucket, add the release to list
        if (releaseTs >= start && releaseTs < end) {
          releasesInBucket.push(props.releases[j]);
          allReleasesInBucket.push(props.releases[j]);
        }
        // Since releases are sorted, once a release timestamp is more recent than the bucket timestamp,
        // we want to break this innerloop and move on to the next bucket.
        //
        // Also we can preserve releaseIterator as it is sorted so we can skip
        // releases that have already been processed
        if (releaseTs >= end) {
          // break this innner for loop and move to next bucket
          releaseIterator = j;
          break;
        }
      }

      buckets.push([start.getTime(), releasesInBucket.length, end.getTime()]);
    }
  }

  return (
    <BaseChart
      ref={e => {
        chartRef.current = e;

        if (e?.getEchartsInstance) {
          registerWithWidgetSyncContext(e.getEchartsInstance());
        }
        const highlightedBuckets = new Set();

        if (e) {
          e.getEchartsInstance()
            .getZr()
            .on('mousemove', function (params) {
              // Tracks movement across the chart and highlights the corresponding release bubble
              const pointInPixel = [params.offsetX, params.offsetY];
              const instance = e.getEchartsInstance();
              const pointInGrid = instance.convertFromPixel('grid', pointInPixel);

              const bucketIndex = buckets.findIndex(([bucketStart, , bucketEnd]) => {
                const ts = pointInGrid[0] ?? -1;
                return ts >= bucketStart && ts < bucketEnd;
              });

              // Already highlighted, no need to do anything
              if (highlightedBuckets.has(bucketIndex)) {
                return;
              }

              const seriesIndex = instance
                .getOption()
                .series.findIndex(s => s.id === 'release-bubble');

              // No release bubble series found (shouldn't happen)
              if (seriesIndex === -1) {
                return;
              }

              // If next bucket is not already highlighted, clear all existing
              // highlights.
              if (!highlightedBuckets.has(bucketIndex)) {
                highlightedBuckets.forEach(dataIndex => {
                  instance.dispatchAction({
                    type: 'downplay',
                    seriesIndex,
                    dataIndex,
                  });
                });
                highlightedBuckets.clear();
              }

              if (bucketIndex > -1) {
                highlightedBuckets.add(bucketIndex);
                instance.dispatchAction({
                  type: 'highlight',
                  seriesIndex,
                  dataIndex: bucketIndex,
                });
              }
            });
        }
      }}
      onClick={(...params) => {
        // TODO: open flyout panel
      }}
      onMouseOut={(params, instance) => {
        if (params.seriesId === 'release-bubble') {
          instance.setOption(
            {
              series: instance.getOption().series.map(s => {
                if (s.id === 'release-mark-area') {
                  return {
                    id: 'release-mark-area',
                    markArea: {data: []},
                  };
                }
                return {
                  id: s.id,
                };
              }),
            },
            {replaceMerge: ['series']}
          );
        }
      }}
      onMouseOver={(params, instance) => {
        if (params.seriesId === 'release-bubble') {
          instance.setOption({
            series: [
              {
                id: 'release-mark-area',
                type: 'custom',
                renderItem: () => {},
                markArea: {
                  data: [
                    [
                      {
                        xAxis: params.data[0],
                      },
                      {
                        xAxis: params.data[2],
                      },
                    ],
                  ],
                },
              },
            ],
          });
        }
      }}
      autoHeightResize
      series={[
        ...plottableSeries,
        buckets.length
          ? {
              id: 'release-bubble',
              type: 'custom',
              name: 'release bubble',
              renderItem: renderReleaseBubble,
              data: buckets,
              triggerLineEvent: true,
              tooltip: {
                trigger: 'item',
                backgroundColor: `${theme.backgroundElevated}`,
                borderWidth: 0,
                extraCssText: `box-shadow: 0 0 0 1px ${theme.translucentBorder}, ${theme.dropShadowHeavy}`,
                transitionDuration: 0,
                padding: 0,
                className: 'tooltip-container',
                formatter: (
                  params: any,
                  ticket: string,
                  callback: (
                    ticket: string,
                    html: string
                  ) => string | HTMLElement | HTMLElement[]
                ) => {
                  return `<div class="tooltip-series">
<div>
${params.data[1]} Releases
</div>
</div>

<div class="tooltip-footer">
Click to view them
</div>
<div class="tooltip-arrow"></div>`;
                },
              },
            }
          : null,
      ].filter(defined)}
      grid={{
        // NOTE: Adding a few pixels of left padding prevents ECharts from
        // incorrectly truncating long labels. See
        // https://github.com/apache/echarts/issues/15562
        left: 2,
        top: showLegend ? 25 : 10,
        right: 4,
        bottom: RELEASE_BUBBLE_SIZE,
        containLabel: true,
      }}
      legend={
        showLegend
          ? {
              top: 0,
              left: 0,
              formatter(name: string) {
                return props.aliases?.[name] ?? formatSeriesName(name);
              },
              selected: props.timeseriesSelection,
            }
          : undefined
      }
      onLegendSelectChanged={event => {
        props?.onTimeseriesSelectionChange?.(event.selected);
      }}
      tooltip={{
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: formatTooltip,
      }}
      xAxis={{
        animation: false,
        axisLine: {onZero: props.releases ? false : true},
        offset: props.releases ? RELEASE_BUBBLE_SIZE : 0,
        axisLabel: {
          padding: [0, 10, 0, 10],
          width: 60,
        },
        splitNumber: 0,
      }}
      yAxis={{
        animation: false,
        axisLabel: {
          formatter(value: number) {
            return formatYAxisValue(value, yAxisFieldType, yAxisUnit ?? undefined);
          },
        },
        axisPointer: {
          type: 'line',
          snap: false,
          lineStyle: {
            type: 'solid',
            width: 0.5,
          },
          label: {
            show: false,
          },
        },
      }}
      {...chartZoomProps}
      isGroupedByDate
      useMultilineDate
      start={start ? new Date(start) : undefined}
      end={end ? new Date(end) : undefined}
      period={period}
      utc={utc ?? undefined}
    />
  );
}

const GLOBAL_STACK_NAME = 'time-series-visualization-widget-stack';
