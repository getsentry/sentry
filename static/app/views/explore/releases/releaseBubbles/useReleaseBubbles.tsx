import {useCallback, useMemo, useRef, useState} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import {debounce} from '@tanstack/react-pacer';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from 'echarts';
import moment from 'moment-timezone';

import {closeModal} from 'sentry/actionCreators/modal';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {RawFlag} from 'sentry/components/featureFlags/utils';
import type {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t, tn} from 'sentry/locale';
import type {
  EChartLegendSelectChangeHandler,
  ReactEchartsRef,
} from 'sentry/types/echarts';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFormat} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useUser} from 'sentry/utils/useUser';
import {
  cleanReleaseCursors,
  ReleasesDrawerFields,
} from 'sentry/views/explore/releases/drawer/utils';
import type {Bucket} from 'sentry/views/explore/releases/releaseBubbles/types';
import {createReleaseBuckets} from 'sentry/views/explore/releases/releaseBubbles/utils/createReleaseBuckets';

const BUBBLE_SERIES_ID = '__release_bubble__';
export const RELEASE_BUBBLE_SERIES_NAME = 'Releases';

interface LegendSelectChangedParams {
  name: string;
  selected: Record<string, boolean>;
}

const DEFAULT_BUBBLE_X_AXIS = {
  axisLine: {onZero: true},
  offset: 0,
};

const DEFAULT_BUBBLE_GRID = {
  bottom: 0,
};

const RELEASE_BUBBLE_Y_AXIS = {
  type: 'value' as const,
  min: 0,
  max: 100,
  show: false,
  // `axisLabel` causes an unwanted whitespace/width on the y-axis.
  axisLabel: {show: false},
  // The main y-axis may enable this via `tooltip.trigger=axis`.
  axisPointer: {show: false},
};

// This needs to be debounced because some charts (e.g. in TimeseriesWidgets)
// are in a group and share events. Thus on a page with 4 widgets, clicking on
// a legend item would result in 4 events.
// Keep this shared across charts; a zero delay coalesces synchronous events.
const trackLegend = debounce(
  (params: LegendSelectChangedParams) => {
    trackAnalytics('releases.bubbles_legend', {
      organization: null,
      selected: Boolean(params.selected[params.name]),
    });
  },
  {wait: 0}
);

interface ReleaseBubbleSeriesProps {
  alignInMiddle: boolean;
  bubblePadding: number;
  bubbleSize: number;
  buckets: Bucket[];
  theme: Theme;
  timezone: string;
  onBucketClick?: (bucket: Bucket) => void;
  yAxisIndex?: number;
}

/**
 * Creates a series item that is used to draw the release bubbles in a chart
 */
function createReleaseBubbleSeries({
  buckets,
  theme,
  bubbleSize,
  bubblePadding,
  alignInMiddle,
  timezone,
  yAxisIndex,
  onBucketClick,
}: ReleaseBubbleSeriesProps) {
  const totalReleases = buckets.reduce(
    (acc, {releases, flags}) => acc + flags.length + releases.length,
    0
  );
  const avgReleases = totalReleases / buckets.length;
  const data = buckets.map(bucket => ({
    value: [bucket.start, 0, bucket.end, bucket.releases.length],
    start: bucket.start,
    end: bucket.end,
    final: bucket.final,
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

    return moment.tz(timestamp, timezone).format(format);
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

    const coordinateSystem = params.coordSys as {
      height?: number;
      width?: number;
      x?: number;
      y?: number;
    };
    const highlightStartX = bubbleStartX - (alignInMiddle ? width / 2 : 0);
    const chartLeft = coordinateSystem.x ?? 0;
    const chartRight = chartLeft + (coordinateSystem.width ?? 0);
    const clippedHighlightStartX = Math.max(highlightStartX, chartLeft);
    const clippedHighlightEndX = Math.min(highlightStartX + width, chartRight);

    return {
      type: 'group',
      children: [
        {
          // Keep the range highlight in the custom item so ECharts can manage
          // hover through emphasis without calling `setOption` from mouse events.
          // It must remain silent so only the bubble itself is a hover target.
          type: 'rect',
          silent: true,
          shape: {
            x: clippedHighlightStartX,
            y: coordinateSystem.y ?? 0,
            width: Math.max(clippedHighlightEndX - clippedHighlightStartX, 0),
            height: coordinateSystem.height ?? 0,
          },
          style: {
            fill: theme.tokens.graphics.accent.vibrant,
            opacity: 0,
          },
          emphasis: {
            style: {opacity: 0.1},
          },
        },
        {
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
        },
      ],
    } satisfies CustomSeriesRenderItemReturn;
  };

  return {
    id: BUBBLE_SERIES_ID,
    type: 'custom',
    yAxisIndex,
    renderItem: renderReleaseBubble,
    name: RELEASE_BUBBLE_SERIES_NAME,
    data,
    color: theme.tokens.graphics.accent.vibrant,
    animation: false,
    // Only hovering an individual bubble should show its emphasized time range.
    legendHoverLink: false,
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
  } satisfies CustomSeriesOption;
}

interface UseReleaseBubblesParams {
  /**
   * The selected state is "controlled" by the calling component (e.g. it
   * implements its own event handler and keeps its own legend-selected
   * state). The hook will return the updated chart options accordingly.
   */
  legendSelected: boolean;
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
   * Unique ID used to associate the releases drawer with this chart.
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
  const [now] = useState(() => Date.now());
  const releasesMaxTime = useMemo(
    () =>
      defined(endTimeToUse) && !Array.isArray(endTimeToUse)
        ? new Date(endTimeToUse).getTime()
        : now,
    [endTimeToUse, now]
  );
  const chartRef = useRef<ReactEchartsRef | null>(null);
  const totalBubblePaddingY = bubblePadding * 2;
  const releaseBubbleXAxis = useMemo(
    () => ({
      // configure `axisLine` and `offset` to move axis line below 0 so that
      // bubbles sit between bottom of the main chart and the axis line
      axisLine: {onZero: false},
      offset: bubbleSize + totalBubblePaddingY - 1,
    }),
    [bubbleSize, totalBubblePaddingY]
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

  const handleChartRef = useCallback((e: ReactEchartsRef | null) => {
    chartRef.current = e;
  }, []);

  // Compose analytics tracking with the chart's existing legend callback so
  // the chart wrapper owns the subscription. Layout follows `legendSelected`.
  const onReleaseBubbleLegendSelectChanged = useCallback<EChartLegendSelectChangeHandler>(
    params => {
      if (
        !buckets.length ||
        params.name !== RELEASE_BUBBLE_SERIES_NAME ||
        !(params.name in params.selected)
      ) {
        return;
      }

      trackLegend(params);
    },
    [buckets.length]
  );

  const releaseBubbleSeries = useMemo(() => {
    if (!buckets.length) {
      return null;
    }

    const series = createReleaseBubbleSeries({
      yAxisIndex,
      alignInMiddle,
      buckets,
      bubbleSize,
      bubblePadding,
      theme,
      timezone: options.timezone,
      onBucketClick: handleBucketClick,
    });

    const formatter = series.tooltip.formatter;
    series.tooltip.formatter = params => {
      // Only show the tooltip of the current chart. Otherwise, all tooltips
      // in the chart group appear.
      return isChartHovered(chartRef.current) ? formatter(params) : '';
    };
    return series;
  }, [
    alignInMiddle,
    bubblePadding,
    bubbleSize,
    buckets,
    handleBucketClick,
    options.timezone,
    theme,
    yAxisIndex,
  ]);

  if (!buckets.length) {
    return {
      connectReleaseBubbleChartRef: handleChartRef,
      onReleaseBubbleLegendSelectChanged,
      releaseBubbleSeries: null,
      releaseBubbleXAxis: {},
      releaseBubbleGrid: {},
      releaseBubbleYAxis: null,
    };
  }

  return {
    connectReleaseBubbleChartRef: handleChartRef,
    onReleaseBubbleLegendSelectChanged,

    /**
     * Series to append to a chart's existing `series`
     */
    releaseBubbleSeries,

    releaseBubbleYAxis: RELEASE_BUBBLE_Y_AXIS,

    /**
     * ECharts xAxis configuration. Spread/override charts `xAxis` prop.
     *
     * Only show the default value if `legendSelected` is explicitly false
     * because that means the user explicitly turned off the legend and the
     * axis should "hide" the space for the bubble.
     */
    releaseBubbleXAxis: legendSelected ? releaseBubbleXAxis : DEFAULT_BUBBLE_X_AXIS,

    /**
     * ECharts grid configuration. Spread/override charts `grid` prop.
     *
     * Only show the default value if `legendSelected` is explicitly false
     * because that means the user explicitly turned off the legend and the
     * axis should "hide" the space for the bubble.
     */
    releaseBubbleGrid: legendSelected ? releaseBubbleGrid : DEFAULT_BUBBLE_GRID,
  };
}
