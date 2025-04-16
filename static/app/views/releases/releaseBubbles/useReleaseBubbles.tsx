import {type ReactElement, useCallback, useMemo, useRef} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  ElementEvent,
} from 'echarts';
import type {EChartsInstance} from 'echarts-for-react';
import debounce from 'lodash/debounce';
import moment from 'moment-timezone';

import {closeModal} from 'sentry/actionCreators/modal';
import {isChartHovered} from 'sentry/components/charts/utils';
import useDrawer from 'sentry/components/globalDrawer';
import type {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t, tn} from 'sentry/locale';
import type {
  EChartClickHandler,
  EChartMouseOutHandler,
  EChartMouseOverHandler,
  ReactEchartsRef,
  Series,
} from 'sentry/types/echarts';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFormat} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {ReleasesDrawer} from 'sentry/views/releases/drawer/releasesDrawer';
import {
  BUBBLE_AREA_SERIES_ID,
  BUBBLE_SERIES_ID,
} from 'sentry/views/releases/releaseBubbles/constants';
import type {
  Bucket,
  ChartRendererProps,
} from 'sentry/views/releases/releaseBubbles/types';
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
  releases: ReleaseMetaBasic[];
  theme: Theme;
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
}: ReleaseBubbleSeriesProps): CustomSeriesOption | null {
  const totalReleases = buckets.reduce((acc, {releases}) => acc + releases.length, 0);
  const avgReleases = totalReleases / buckets.length;
  const data = buckets.map(({start, end, releases}) => ({
    value: [start, 0, end, releases.length],
    start,
    end,
    releases,
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

    const numberReleases = dataItem.releases.length;

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
        fill: theme.blue400,
        // TODO: figure out correct opacity calculations
        opacity: Math.round((Number(numberReleases) / avgReleases) * 50) / 100,
      },
    } satisfies CustomSeriesRenderItemReturn;
  };

  return {
    id: BUBBLE_SERIES_ID,
    type: 'custom',
    renderItem: renderReleaseBubble,
    name: t('Releases'),
    data,
    color: theme.blue300,
    animation: false,
    markLine: {
      silent: true,
      symbol: 'none',
      label: {
        show: false,
      },
      lineStyle: {
        color: theme.gray300,
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
        return `
<div class="tooltip-series tooltip-release">
<div>
${tn('%s Release', '%s Releases', numberReleases)}
</div>
<div class="tooltip-release-timerange">
${formatBucketTimestamp(bucket.start)} - ${formatBucketTimestamp(bucket.final ?? bucket.end)}
</div>
</div>

${
  numberReleases > 0
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
   * This is a callback function that is used in ReleasesDrawer when rendering
   * the chart inside of the drawer.
   */
  chartRenderer?: (rendererProps: ChartRendererProps) => ReactElement;
  datetime?: Parameters<typeof normalizeDateTimeParams>[0];
  /**
   * Number of desired bubbles/buckets to create
   */
  desiredBuckets?: number;
  environments?: readonly string[];
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
}

export function useReleaseBubbles({
  chartRenderer,
  releases,
  minTime,
  maxTime,
  datetime,
  environments,
  projects,
  legendSelected,
  alignInMiddle = false,
  bubbleSize = 4,
  bubblePadding = 2,
  desiredBuckets = 10,
}: UseReleaseBubblesParams) {
  const organization = useOrganization();
  const {openDrawer} = useDrawer();
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
  const hasReleaseBubbles = organization.features.includes('release-bubbles-ui');
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
      (hasReleaseBubbles &&
        releases?.length &&
        minTime &&
        maxTime &&
        createReleaseBuckets({
          minTime,
          maxTime,
          finalTime: releasesMaxTime,
          releases,
          desiredBuckets,
        })) ||
      [],
    [desiredBuckets, hasReleaseBubbles, maxTime, minTime, releases, releasesMaxTime]
  );

  const handleChartRef = useCallback(
    (e: ReactEchartsRef | null) => {
      chartRef.current = e;

      const echartsInstance: EChartsInstance = e?.getEchartsInstance?.();
      const highlightedBuckets = new Set();

      const handleMouseMove = (params: ElementEvent) => {
        // Tracks movement across the chart and highlights the corresponding release bubble
        const pointInPixel = [params.offsetX, params.offsetY];
        const pointInGrid = echartsInstance.convertFromPixel('grid', pointInPixel);
        const series = echartsInstance.getOption().series;
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
      const handleSeriesClick = (params: Parameters<EChartClickHandler>[0]) => {
        if (params.seriesId !== BUBBLE_SERIES_ID) {
          return;
        }

        // `data` is typed as Record<string, any> by ECharts, with no generics
        // to override
        const data = params.data as unknown as Bucket;

        // "Full Screen View" for Insights opens in a modal, close before opening
        // drawer.
        closeModal();

        openDrawer(
          () => (
            <ReleasesDrawer
              startTs={data.start}
              endTs={data.final ?? data.end}
              releases={data.releases}
              buckets={buckets}
              projects={projects ?? selection.projects}
              environments={environments ?? selection.environments}
              chartRenderer={chartRenderer}
            />
          ),
          {
            shouldCloseOnLocationChange: () => false,
            ariaLabel: t('Releases drawer'),
            transitionProps: {stiffness: 1000},
          }
        );
      };

      const handleMouseOver = (params: Parameters<EChartMouseOverHandler>[0]) => {
        if (params.seriesId !== BUBBLE_SERIES_ID) {
          return;
        }

        const data = params.data as unknown as Bucket;

        // Match behavior of ReleaseBubblSeries
        const xAxisShift = alignInMiddle ? (data.end - data.start) / 2 : 0;

        // Create an empty series that has a `markArea` which is then
        // rectangular area of the "release bucket" that was hovered over (in
        // the release bubbles). This is drawn on the main chart so that users
        // can visualize the time block of the set of relases.
        echartsInstance.setOption({
          series: [
            {
              id: BUBBLE_AREA_SERIES_ID,
              type: 'custom',
              renderItem: () => {},
              markArea: {
                itemStyle: {color: theme.blue400, opacity: 0.1},
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
            },
          ],
        });
      };

      const handleMouseOut = (params: Parameters<EChartMouseOutHandler>[0]) => {
        if (params.seriesId !== BUBBLE_SERIES_ID) {
          return;
        }

        // Clear the `markArea` that was drawn during mouse over
        echartsInstance.setOption({
          series: [{id: BUBBLE_AREA_SERIES_ID, markArea: {data: []}}],
        });
      };

      // This fixes a bug where if you hover over a bubble and mouseout via xaxis
      // (i.e. bottom of chart), the bubble will remain highlighted. This makes it
      // look buggy and can be misleading especially for bubbles w/ 0 releases.
      const handleGlobalOut = () => {
        if (!echartsInstance) {
          return;
        }

        const series = echartsInstance.getOption().series;
        const seriesIndex = series.findIndex((s: Series) => s.id === BUBBLE_SERIES_ID);
        // We could find and include a `dataIndex` to be specific about which
        // bubble to "downplay", but I think it's ok to downplay everything
        echartsInstance.dispatchAction({
          type: 'downplay',
          seriesIndex,
        });
      };

      const handleLegendSelectChanged = (params: LegendSelectChangedParams) => {
        if (params.name !== 'Releases' || !('Releases' in params.selected)) {
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

      if (echartsInstance) {
        /**
         * MouseListeners for echarts. This includes drawing a highlighted area on the
         * main chart when a release bubble is hovered over.
         *
         * Attach directly to instance to avoid collisions with React props
         */
        echartsInstance.on('click', handleSeriesClick);
        echartsInstance.on('mouseover', handleMouseOver);
        echartsInstance.on('mouseout', handleMouseOut);
        echartsInstance.on('globalout', handleGlobalOut);
        echartsInstance.on('legendselectchanged', handleLegendSelectChanged);
        echartsInstance.getZr().on('mousemove', handleMouseMove);
      }

      return () => {
        if (!echartsInstance) {
          return;
        }

        echartsInstance.off('click', handleSeriesClick);
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
      chartRenderer,
      environments,
      openDrawer,
      projects,
      selection.environments,
      selection.projects,
      defaultBubbleGrid,
      defaultBubbleXAxis,
      legendSelected,
      releaseBubbleGrid,
      releaseBubbleXAxis,
      theme.blue400,
    ]
  );

  if (!releases || !buckets.length) {
    return {
      connectReleaseBubbleChartRef: () => {},
      ReleaseBubbleSeries: null,
      releaseBubbleXAxis: {},
      releaseBubbleGrid: {},
    };
  }

  return {
    connectReleaseBubbleChartRef: handleChartRef,

    /**
     * Series to append to a chart's existing `series`
     */
    releaseBubbleSeries: ReleaseBubbleSeries({
      alignInMiddle,
      buckets,
      bubbleSize,
      bubblePadding,
      chartRef,
      theme,
      releases,
      dateFormatOptions: {
        timezone: options.timezone,
      },
    }),

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
