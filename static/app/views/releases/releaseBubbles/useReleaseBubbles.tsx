import {useCallback, useMemo, useRef} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  ElementEvent,
} from 'echarts';
import debounce from 'lodash/debounce';
import moment from 'moment-timezone';

import {closeModal} from 'sentry/actionCreators/modal';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {RawFlag} from 'sentry/components/featureFlags/utils';
import type {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t, tn} from 'sentry/locale';
import type {
  EChartMouseOutHandler,
  EChartMouseOverHandler,
  ReactEchartsRef,
  Series,
} from 'sentry/types/echarts';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFormat} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {
  cleanReleaseCursors,
  ReleasesDrawerFields,
} from 'sentry/views/releases/drawer/utils';
import {
  BUBBLE_AREA_SERIES_ID,
  BUBBLE_SERIES_ID,
} from 'sentry/views/releases/releaseBubbles/constants';
import type {Bucket} from 'sentry/views/releases/releaseBubbles/types';
import {createReleaseBuckets} from 'sentry/views/releases/releaseBubbles/utils/createReleaseBuckets';

interface LegendSelectChangedParams {
  name: string;
  selected: Record<string, boolean>;
}

// This needs to be debounced because some charts (e.g. in TimeseriesWidgets)
// are in a group and share events. Thus on a page with 4 widgets, clicking on
// a legend item would result in 4 events.
const trackLegend = debounce((params: LegendSelectChangedParams) => {
  trackAnalytics('releases.bubbles_legend', {
    organization: null,
    selected: Boolean(params.selected.Releases),
  });
});

interface ReleaseBubbleSeriesProps {
  alignInMiddle: boolean;
  bubblePadding: number;
  bubbleSize: number;
  buckets: Bucket[];
  chartRef: React.RefObject<ReactEchartsRef | null>;
  dateFormatOptions: {
    timezone: string;
  };
  theme: Theme;
  onBucketClick?: (bucket: Bucket) => void;
  yAxisIndex?: number;
}

/**
 * Creates a series item that is used to draw the release bubbles in a chart
 */
function ReleaseBubbleSeries({
  buckets,
  chartRef,
  theme,
  bubbleSize,
  bubblePadding,
  dateFormatOptions,
  alignInMiddle,
  yAxisIndex,
  onBucketClick,
}: ReleaseBubbleSeriesProps): CustomSeriesOption | null {
  const totalReleases = buckets.reduce(
    (acc, {releases, flags}) => acc + flags.length + releases.length,
    0
  );
  const avgReleases = totalReleases / buckets.length;
  const data = buckets.map(bucket => ({
    value: [bucket.start, 0, bucket.end, bucket.releases.length],
    start: bucket.start,
    end: bucket.end,
    releases: bucket.releases,
    flags: bucket.flags,
    onClick: (clickSeries: any) => {
      if (clickSeries?.seriesId !== BUBBLE_SERIES_ID) {
        return;
      }
      onBucketClick?.(bucket);
    },
  }));

  const formatBucketTimestamp = (timestamp: number) => {
    // TODO: we might want to be smarter about formatting when the buckets are
    // both in the same day, or if time difference is very small (e.g. hours)
    const format = getFormat({
      dateOnly: false,
      timeOnly: false,
      year: moment().year() !== moment(timestamp).year(),
    });

    return moment.tz(timestamp, dateFormatOptions.timezone).format(format);
  };

  /**
   * Renders release bubbles underneath the main chart
   */
  const renderReleaseBubble: CustomSeriesRenderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
  ) => {
    const dataItem = data[params.dataIndex];

    if (!dataItem) {
      return null;
    }

    // Use the start/end timestamps to get the chart coordinates to draw the
    // bubble. The 2nd tuple passed to `api.coord()` is always 0 because we
    // don't care about the y-coordinate as the bubbles have a static height.
    const [bubbleStartX, bubbleStartY] = api.coord([dataItem.start, 0]);
    const [bubbleEndX] = api.coord([dataItem.end, 0]);

    if (!defined(bubbleStartX) || !defined(bubbleStartY) || !defined(bubbleEndX)) {
      return null;
    }

    const numberReleases = dataItem.releases.length + dataItem.flags.length;

    // Width between two timestamps for timeSeries
    const width = bubbleEndX - bubbleStartX;

    const shape = {
      // Padding is on both left/right sides to try to center the bubble
      //
      //  bubbleStartX   bubbleEndX
      //  |              |
      //  v              v
      //  ----------------  ----------------
      //  |              |  |              |
      //  ----------------  ----------------
      //                 ^  ^
      //                 |--|
      //                 bubblePadding

      // If `alignInMiddle` is true, we shift the starting x positon back by
      // 50% of width so that the middle of the bubble aligns with starting
      // timestamp. This matches the behavior of EChart's bar charts.
      x: bubbleStartX + bubblePadding / 2 - (alignInMiddle ? width / 2 : 0),
      width: width - bubblePadding,

      // We configure base chart's grid and xAxis to create a gap size of
      // `bubbleSize`. We then have to configure `y` and `height` to fit within this
      //
      // ----------------- grid bottom
      //   | bubblePadding
      //   | bubbleSize
      //   | bubblePadding
      // ----------------- = xAxis offset

      // idk exactly what's happening but we need a 1 pixel buffer to make it
      // properly centered. I want to guess because we are drawing below the
      // xAxis, and we have to account for the pixel being drawn in the other
      // direction. You can see this if you set the x-axis offset to 0 and compare.
      y: bubbleStartY + bubblePadding,
      height: bubbleSize,

      // border radius
      r: 0,
    };

    return {
      type: 'rect',
      transition: ['shape'],
      shape,
      style: {
        // Use lineWidth to "fake" padding so that mouse events are triggered
        // in the "padding" areas (i.e. so tooltips open)
        lineWidth: bubblePadding,
        stroke: 'transparent',
        fill: theme.tokens.graphics.accent.vibrant,
        // TODO: figure out correct opacity calculations
        opacity: Math.round((Number(numberReleases) / avgReleases) * 50) / 100,
      },
    } satisfies CustomSeriesRenderItemReturn;
  };

  return {
    id: BUBBLE_SERIES_ID,
    type: 'custom',
    yAxisIndex,
    renderItem: renderReleaseBubble,
    name: t('Releases'),
    data,
    color: theme.tokens.graphics.accent.vibrant,
    animation: false,
    markLine: {
      silent: true,
      symbol: 'none',
      label: {
        show: false,
      },
      lineStyle: {
        color: theme.colors.gray400,
        opacity: 0.5,
        type: 'solid',
        width: 1,
      },
      data: [{yAxis: 0}],
    },
    tooltip: {
      trigger: 'item',
      position: 'bottom',
      formatter: params => {
        // Only show the tooltip of the current chart. Otherwise, all tooltips
        // in the chart group appear.
        if (!isChartHovered(chartRef?.current)) {
          return '';
        }

        const bucket = params.data as Bucket;
        const numberReleases = bucket.releases.length;
        const numberFlags = bucket.flags.length;
        return `
<div class="tooltip-series tooltip-release">
<div>
${tn('%s Release', '%s Releases', numberReleases)}
</div>
${
  numberFlags > 0
    ? `<div>
${tn('%s Flag', '%s Flags', numberFlags)}
</div>`
    : ''
}
<div class="tooltip-release-timerange">
${formatBucketTimestamp(bucket.start)} - ${formatBucketTimestamp(bucket.final ?? bucket.end)}
</div>
</div>

${
  numberReleases > 0 || numberFlags > 0
    ? `<div class="tooltip-footer tooltip-release">
${t('Click to expand')}
</div>`
    : ''
}
<div class="tooltip-arrow arrow-top"></div>
`;
      },
    },
  };
}

interface UseReleaseBubblesParams {
  /**
   * Align the starting timestamp to the middle of the release bubble (e.g. if
   * we want to match ECharts' bar charts), otherwise we draw starting at
   * starting timestamp
   */
  alignInMiddle?: boolean;

  /**
   * The whitespace around the bubbles.
   */
  bubblePadding?: number;
  /**
   * The size (height) of the bubble
   */
  bubbleSize?: number;
  /**
   * Unique ID for chart, used to load and render chart
   */
  chartId?: string;
  datetime?: Parameters<typeof normalizeDateTimeParams>[0];
  /**
   * Number of desired bubbles/buckets to create
   */
  desiredBuckets?: number;
  environments?: readonly string[];
  eventId?: string;
  /**
   * List of feature flag events to include in the bubbles
   */
  flags?: RawFlag[];
  legendSelected?: boolean;
  /**
   * The maximum/latest timestamp of the chart's timeseries
   */
  maxTime?: number;
  /**
   * The minimum/earliest timestamp of the chart's timeseries
   */
  minTime?: number;
  projects?: readonly number[];
  /**
   * List of releases that will be grouped
   */
  releases?: ReleaseMetaBasic[];
  /**
   * The index of the y-axis to use for the release bubbles
   */
  yAxisIndex?: number;
}

export function useReleaseBubbles({
  chartId,
  eventId,
  releases,
  minTime,
  maxTime,
  datetime,
  environments,
  projects,
  legendSelected,
  yAxisIndex,
  alignInMiddle = false,
  bubbleSize = 4,
  bubblePadding = 2,
  desiredBuckets = 10,
  flags,
}: UseReleaseBubblesParams) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const {options} = useUser();
  const {selection} = usePageFilters();
  // `maxTime` refers to the max time on x-axis for charts.
  // There may be the need to include releases that are > maxTime (e.g. in the
  // case of relative date selection). This is used for the tooltip to show the
  // proper timestamp for releases.
  const endTimeToUse = (datetime || selection.datetime).end;
  const releasesMaxTime =
    defined(endTimeToUse) && !Array.isArray(endTimeToUse)
      ? new Date(endTimeToUse).getTime()
      : Date.now();
  const chartRef = useRef<ReactEchartsRef | null>(null);
  const totalBubblePaddingY = bubblePadding * 2;
  const defaultBubbleXAxis = useMemo(
    () => ({
      axisLine: {onZero: true},
      offset: 0,
    }),
    []
  );
  const defaultBubbleGrid = useMemo(
    () => ({
      bottom: 0,
    }),
    []
  );
  const releaseBubbleXAxis = useMemo(
    () => ({
      // configure `axisLine` and `offset` to move axis line below 0 so that
      // bubbles sit between bottom of the main chart and the axis line
      axisLine: {onZero: false},
      offset: bubbleSize + totalBubblePaddingY - 1,
    }),
    [bubbleSize, totalBubblePaddingY]
  );

  const releaseBubbleYAxis = useMemo(
    () => ({
      type: 'value' as const,
      min: 0,
      max: 100,
      show: false,
      // `axisLabel` causes an unwanted whitespace/width on the y-axis
      axisLabel: {show: false},
      // Hides an axis line + tooltip when hovering on chart
      // This is default `false`, but the main y-axis has
      // `tooltip.trigger=axis` which will cause this to be enabled.
      axisPointer: {show: false},
    }),
    []
  );

  const releaseBubbleGrid = useMemo(
    () => ({
      // Moves bottom of grid "up" `bubbleSize` pixels so that bubbles are
      // drawn below grid (but above x axis label)
      bottom: bubbleSize + totalBubblePaddingY + 1,
    }),
    [bubbleSize, totalBubblePaddingY]
  );

  const buckets = useMemo(
    () =>
      ((releases?.length || flags?.length) &&
        minTime &&
        maxTime &&
        createReleaseBuckets({
          minTime,
          maxTime,
          finalTime: releasesMaxTime,
          releases,
          flags,
          desiredBuckets,
        })) ||
      [],
    [desiredBuckets, flags, maxTime, minTime, releases, releasesMaxTime]
  );

  const handleBucketClick = useCallback(
    (bucket: Bucket) => {
      closeModal();

      navigate({
        query: {
          ...cleanReleaseCursors(location.query),
          [ReleasesDrawerFields.DRAWER]: 'show',
          [ReleasesDrawerFields.CHART]: chartId,
          [ReleasesDrawerFields.EVENT_ID]: eventId,
          [ReleasesDrawerFields.START]: new Date(bucket.start).toISOString(),
          [ReleasesDrawerFields.END]: new Date(bucket.end).toISOString(),
          [ReleasesDrawerFields.PROJECT]: projects ?? selection.projects,
          [ReleasesDrawerFields.ENVIRONMENT]: environments ?? selection.environments,
        },
      });
    },
    [
      chartId,
      eventId,
      navigate,
      location.query,
      projects,
      environments,
      selection.projects,
      selection.environments,
    ]
  );

  const handleChartRef = useCallback(
    (e: ReactEchartsRef | null) => {
      chartRef.current = e;

      const echartsInstance = e?.getEchartsInstance?.();
      const highlightedBuckets = new Set();

      const handleMouseMove = (params: ElementEvent) => {
        if (!echartsInstance) {
          return;
        }

        // Tracks movement across the chart and highlights the corresponding release bubble
        const pointInPixel = [params.offsetX, params.offsetY];
        const pointInGrid = echartsInstance.convertFromPixel('grid', pointInPixel);
        const series = echartsInstance.getOption().series as Series[];
        const seriesIndex = series.findIndex((s: Series) => s.id === BUBBLE_SERIES_ID);

        // No release bubble series found (shouldn't happen)
        if (seriesIndex === -1) {
          return;
        }
        const bubbleSeries = series[seriesIndex];
        const bucketsFromSeries = bubbleSeries?.data;

        if (!bucketsFromSeries) {
          return;
        }

        // Try to find the bucket that the mouse is hovered over
        const bucketIndex = buckets.findIndex(({start, end}: Bucket) => {
          const ts = pointInGrid[0] ?? -1;
          return ts >= start && ts < end;
        });

        // Already highlighted, no need to do anything
        if (highlightedBuckets.has(bucketIndex)) {
          return;
        }

        // If next bucket is not already highlighted, clear all existing
        // highlights. We also want to clear if bucket was *not* found.
        if (!highlightedBuckets.has(bucketIndex)) {
          highlightedBuckets.forEach(dataIndex => {
            echartsInstance.dispatchAction({
              type: 'downplay',
              seriesIndex,
              dataIndex,
            });
          });
          highlightedBuckets.clear();
        }

        // A bucket was found, dispatch "highlight" action --
        // this is styled via `renderReleaseBubble` -> `emphasis`
        if (bucketIndex > -1) {
          highlightedBuckets.add(bucketIndex);
          echartsInstance.dispatchAction({
            type: 'highlight',
            seriesIndex,
            dataIndex: bucketIndex,
          });
        }
      };

      const handleMouseOver = (params: Parameters<EChartMouseOverHandler>[0]) => {
        if (params.seriesId !== BUBBLE_SERIES_ID || !echartsInstance) {
          return;
        }

        const data = params.data as unknown as Bucket;

        // Match behavior of ReleaseBubblSeries
        const xAxisShift = alignInMiddle ? (data.end - data.start) / 2 : 0;

        // Create an empty series that has a `markArea` which is then
        // rectangular area of the "release bucket" that was hovered over (in
        // the release bubbles). This is drawn on the main chart so that users
        // can visualize the time block of the set of relases.
        const customSeries: CustomSeriesOption = {
          id: BUBBLE_AREA_SERIES_ID,
          type: 'custom',
          renderItem: () => null,
          markArea: {
            itemStyle: {color: theme.tokens.graphics.accent.vibrant, opacity: 0.1},
            data: [
              [
                {
                  xAxis: data.start - xAxisShift,
                },
                {
                  xAxis: data.end - xAxisShift,
                },
              ],
            ],
          },
        };
        echartsInstance.setOption({series: [customSeries]}, {lazyUpdate: true});
      };

      const handleMouseOut = (params: Parameters<EChartMouseOutHandler>[0]) => {
        if (params.seriesId !== BUBBLE_SERIES_ID || !echartsInstance) {
          return;
        }

        // Clear the `markArea` that was drawn during mouse over
        echartsInstance.setOption(
          {
            series: [{id: BUBBLE_AREA_SERIES_ID, markArea: {data: []}}],
          },
          {
            lazyUpdate: true,
          }
        );
      };

      // This fixes a bug where if you hover over a bubble and mouseout via xaxis
      // (i.e. bottom of chart), the bubble will remain highlighted. This makes it
      // look buggy and can be misleading especially for bubbles w/ 0 releases.
      const handleGlobalOut = () => {
        if (!echartsInstance) {
          return;
        }

        const series = echartsInstance.getOption().series as Series[];
        const seriesIndex = series.findIndex((s: Series) => s.id === BUBBLE_SERIES_ID);
        // We could find and include a `dataIndex` to be specific about which
        // bubble to "downplay", but I think it's ok to downplay everything
        echartsInstance.dispatchAction({
          type: 'downplay',
          seriesIndex,
        });
      };

      const handleLegendSelectChanged = (params: LegendSelectChangedParams) => {
        if (
          params.name !== 'Releases' ||
          !('Releases' in params.selected) ||
          !echartsInstance
        ) {
          return;
        }
        const selected = params.selected.Releases;

        // If `legendSelected` is defined, this hook will assume that the
        // selected state is "controlled" by the calling component (e.g. it
        // implements its own event handler and keeps its own legend-selected
        // state). The hook will return the updated chart options accordingly.
        if (legendSelected !== undefined) {
          return;
        }
        // Callback for when Releases legend status changes -- we want to
        // adjust the xAxis/grid accordingly when Releases are visible or
        // not
        echartsInstance.setOption({
          xAxis: selected ? releaseBubbleXAxis : defaultBubbleXAxis,
          grid: selected ? releaseBubbleGrid : defaultBubbleGrid,
        });

        trackLegend(params);
      };

      // @ts-expect-error `getModel` is private, but we access it to prevent binding mouse events to an instance of ECharts that hasn't been fully initialized. A more robust pattern is to attach mouse events using `onChartReady` instead of `ref`, but that causes manually bound mouse events to be overridden by the contents of the `onEvents` prop, since `onChartReady` only fires once, while the `ref` fires more often, and the manual events are re-added.
      if (echartsInstance?.getModel()) {
        /**
         * MouseListeners for echarts. This includes drawing a highlighted area on the
         * main chart when a release bubble is hovered over.
         *
         * Attach directly to instance to avoid collisions with React props
         */
        // @ts-expect-error not sure what type echarts is expecting here
        echartsInstance.on('mouseover', handleMouseOver);
        // @ts-expect-error not sure what type echarts is expecting here
        echartsInstance.on('mouseout', handleMouseOut);
        echartsInstance.on('globalout', handleGlobalOut);
        // @ts-expect-error ECharts types `params` as unknown
        echartsInstance.on('legendselectchanged', handleLegendSelectChanged);
        echartsInstance.getZr().on('mousemove', handleMouseMove);
      }

      return () => {
        if (!echartsInstance) {
          return;
        }

        echartsInstance.off('mouseover', handleMouseOver);
        echartsInstance.off('mouseout', handleMouseOut);
        echartsInstance.off('globalout', handleGlobalOut);
        echartsInstance.off('legendselectchanged', handleLegendSelectChanged);
        echartsInstance.getZr().off('mousemove', handleMouseMove);
      };
    },
    [
      alignInMiddle,
      buckets,
      defaultBubbleGrid,
      defaultBubbleXAxis,
      legendSelected,
      releaseBubbleGrid,
      releaseBubbleXAxis,
      theme.tokens.graphics.accent.vibrant,
    ]
  );

  if (!releases || !buckets.length) {
    return {
      connectReleaseBubbleChartRef: () => {},
      ReleaseBubbleSeries: null,
      releaseBubbleXAxis: {},
      releaseBubbleGrid: {},
      releaseBubbleYAxis: null,
    };
  }

  return {
    connectReleaseBubbleChartRef: handleChartRef,

    /**
     * Series to append to a chart's existing `series`
     */
    releaseBubbleSeries: ReleaseBubbleSeries({
      yAxisIndex,
      alignInMiddle,
      buckets,
      bubbleSize,
      bubblePadding,
      chartRef,
      theme,
      onBucketClick: handleBucketClick,
      dateFormatOptions: {
        timezone: options.timezone,
      },
    }),

    releaseBubbleYAxis,

    /**
     * ECharts xAxis configuration. Spread/override charts `xAxis` prop.
     *
     * Only show the default value if `legendSelected` is explicitly false
     * because that means the user explicitly turned off the legend and the
     * axis should "hide" the space for the bubble. `legendSelected` should be
     * undefined if the calling component does not keep its own "legend
     * selected" state.
     */
    releaseBubbleXAxis:
      legendSelected === false ? defaultBubbleXAxis : releaseBubbleXAxis,

    /**
     * ECharts grid configuration. Spread/override charts `grid` prop.
     *
     * Only show the default value if `legendSelected` is explicitly false
     * because that means the user explicitly turned off the legend and the
     * axis should "hide" the space for the bubble. `legendSelected` should be
     * undefined if the calling component does not keep its own "legend
     * selected" state.
     */
    releaseBubbleGrid: legendSelected === false ? defaultBubbleGrid : releaseBubbleGrid,
  };
}
