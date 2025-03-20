import {type ReactElement, useCallback, useRef} from 'react';
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
import type {Bucket} from 'sentry/views/releases/releaseBubbles/types';
import {createReleaseBuckets} from 'sentry/views/releases/releaseBubbles/utils/createReleaseBuckets';

interface CreateReleaseBubbleMouseListenersParams {
  buckets: Bucket[];
  color: string;
  openDrawer: (
    renderer: DrawerConfig['renderer'],
    options: DrawerConfig['options']
  ) => void;
  chartRenderer?: (rendererProps: {
    end: Date;
    releases: ReleaseMetaBasic[];
    start: Date;
  }) => ReactElement;
}

/**
 * MouseListeners for echarts. This includes drawing a highlighted area on the
 * main chart when a release bubble is hovered over.
 */
function createReleaseBubbleMouseListeners({
  chartRenderer,
  color,
  openDrawer,
  buckets,
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
                    xAxis: data.start,
                  },
                  {
                    xAxis: data.end,
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
    const [bubbleEndX, bubbleEndY] = api.coord([dataItem.end, 0]);

    if (
      !defined(bubbleStartX) ||
      !defined(bubbleStartY) ||
      !defined(bubbleEndX) ||
      !defined(bubbleEndY)
    ) {
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

      x: bubbleStartX + bubblePadding / 2,
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
  bubblePadding?: number;
  bubbleSize?: number;
  chartRenderer?: (rendererProps: {
    end: Date;
    releases: ReleaseMetaBasic[];
    start: Date;
  }) => ReactElement;
  maxTime?: number;
  minTime?: number;
  releases?: ReleaseMetaBasic[];
}
export function useReleaseBubbles({
  chartRenderer,
  releases,
  minTime,
  maxTime,
  bubbleSize = 4,
  bubblePadding = 2,
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
  const releasesMaxTime = defined(selection.datetime.end)
    ? new Date(selection.datetime.end).getTime()
    : Date.now();
  const chartRef = useRef<ReactEchartsRef | null>(null);
  const hasReleaseBubbles = organization.features.includes('release-bubbles-ui');
  const handleChartRef = useCallback((e: ReactEchartsRef | null) => {
    chartRef.current = e;

    if (e?.getEchartsInstance) {
      createReleaseBubbleHighlighter(e.getEchartsInstance());
    }
  }, []);

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

  const totalBubblePaddingY = bubblePadding * 2;

  return {
    connectReleaseBubbleChartRef: handleChartRef,

    /**
     * An object map of ECharts event handlers. These should be spread onto a Chart component
     */
    releaseBubbleEventHandlers: createReleaseBubbleMouseListeners({
      buckets,
      chartRenderer,
      color: theme.blue400,
      openDrawer,
    }),

    /**
     * Series to append to a chart's existing `series`
     */
    releaseBubbleSeries: ReleaseBubbleSeries({
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
     * ECharts xAxis configuration. Spread/override charts `xAxis` prop
     */
    releaseBubbleXAxis: {
      // configure `axisLine` and `offset` to move axis line below 0 so that
      // bubbles sit between bottom of the main chart and the axis line
      axisLine: {onZero: false},
      offset: bubbleSize + totalBubblePaddingY - 1,
    },

    /**
     * ECharts grid configuration. Spread/override charts `grid` prop
     */
    releaseBubbleGrid: {
      // Moves bottom of grid "up" `bubbleSize` pixels so that bubbles are
      // drawn below grid (but above x axis label)
      bottom: bubbleSize + totalBubblePaddingY + 1,
    },
  };
}
