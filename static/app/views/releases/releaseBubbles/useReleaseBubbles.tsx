import {type ReactElement, useMemo, useRef} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from 'echarts';
import type {EChartsInstance} from 'echarts-for-react';
import moment from 'moment-timezone';

import {closeModal} from 'sentry/actionCreators/modal';
import {isChartHovered} from 'sentry/components/charts/utils';
import useDrawer, {type DrawerConfig} from 'sentry/components/globalDrawer';
import type {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t, tn} from 'sentry/locale';
import type {
  EChartClickHandler,
  EChartMouseOutHandler,
  EChartMouseOverHandler,
  ReactEchartsRef,
} from 'sentry/types/echarts';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import {getFormat} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {ReleasesDrawer} from 'sentry/views/releases/drawer/releasesDrawer';
import {
  BUBBLE_AREA_SERIES_ID,
  BUBBLE_SERIES_ID,
} from 'sentry/views/releases/releaseBubbles/constants';
import {createReleaseBubbleHighlighter} from 'sentry/views/releases/releaseBubbles/createReleaseBubbleHighlighter';
import type {
  Bucket,
  ChartRendererProps,
} from 'sentry/views/releases/releaseBubbles/types';
import {createReleaseBuckets} from 'sentry/views/releases/releaseBubbles/utils/createReleaseBuckets';

interface CreateReleaseBubbleMouseListenersParams {
  alignInMiddle: boolean;
  buckets: Bucket[];
  color: string;
  environments: readonly string[];
  openDrawer: (
    renderer: DrawerConfig['renderer'],
    options: DrawerConfig['options']
  ) => void;
  projects: readonly number[];
  chartRenderer?: (rendererProps: ChartRendererProps) => ReactElement;
}

/**
 * MouseListeners for echarts. This includes drawing a highlighted area on the
 * main chart when a release bubble is hovered over.
 */
function createReleaseBubbleMouseListeners({
  alignInMiddle,
  chartRenderer,
  color,
  openDrawer,
  buckets,
  projects,
  environments,
}: CreateReleaseBubbleMouseListenersParams) {
  return {
    onClick: (params: Parameters<EChartClickHandler>[0]) => {
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
            projects={projects}
            environments={environments}
            chartRenderer={chartRenderer}
          />
        ),
        {
          shouldCloseOnLocationChange: () => false,
          ariaLabel: t('Releases drawer'),
          transitionProps: {stiffness: 1000},
        }
      );
    },
    onMouseOut: (
      params: Parameters<EChartMouseOutHandler>[0],
      instance: EChartsInstance
    ) => {
      if (params.seriesId !== BUBBLE_SERIES_ID) {
        return;
      }

      // Clear the `markArea` that was drawn during mouse over
      instance.setOption({
        series: [{id: BUBBLE_AREA_SERIES_ID, markArea: {data: []}}],
      });
    },
    onMouseOver: (
      params: Parameters<EChartMouseOverHandler>[0],
      instance: EChartsInstance
    ) => {
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
      instance.setOption({
        series: [
          {
            id: BUBBLE_AREA_SERIES_ID,
            type: 'custom',
            renderItem: () => {},
            markArea: {
              itemStyle: {color, opacity: 0.1},
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
    },
  };
}

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

  const handleChartRef = (e: ReactEchartsRef | null) => {
    chartRef.current = e;

    if (e?.getEchartsInstance) {
      const echartsInstance = e.getEchartsInstance();
      createReleaseBubbleHighlighter(echartsInstance, {
        onLegendChange: (selected: boolean) => {
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
        },
      });
    }
  };

  const buckets =
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
    [];

  if (!releases || !buckets.length) {
    return {
      connectReleaseBubbleChartRef: () => {},
      releaseBubbleEventHandlers: {},
      ReleaseBubbleSeries: null,
      releaseBubbleXAxis: {},
      releaseBubbleGrid: {},
    };
  }

  return {
    connectReleaseBubbleChartRef: handleChartRef,

    /**
     * An object map of ECharts event handlers. These should be spread onto a Chart component
     */
    releaseBubbleEventHandlers: createReleaseBubbleMouseListeners({
      alignInMiddle,
      buckets,
      chartRenderer,
      color: theme.blue400,
      openDrawer,
      projects: projects ?? selection.projects,
      environments: environments ?? selection.environments,
    }),

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
