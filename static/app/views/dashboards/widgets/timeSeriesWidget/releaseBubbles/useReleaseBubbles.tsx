import {type ReactElement, useCallback, useEffect, useRef} from 'react';
import type {Theme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from 'echarts';
import type {EChartsInstance} from 'echarts-for-react';
import type EChartsReactCore from 'echarts-for-react/lib/core';

import {closeModal} from 'sentry/actionCreators/modal';
import {isChartHovered} from 'sentry/components/charts/utils';
import useDrawer, {type DrawerConfig} from 'sentry/components/globalDrawer';
import {ReleasesDrawer} from 'sentry/components/releases/releasesDrawer';
import {t} from 'sentry/locale';
import type {
  EChartClickHandler,
  EChartMouseOutHandler,
  EChartMouseOverHandler,
  ReactEchartsRef,
} from 'sentry/types/echarts';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import {BUBBLE_SERIES_ID} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/constants';
import {createReleaseBubbleHighlighter} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/createReleaseBubbleHighlighter';
import type {Bucket} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/types';
import {createReleaseBuckets} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/utils/createReleaseBuckets';
import type {TimeSeriesWidgetVisualizationProps} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

const BUBBLE_AREA_SERIES_ID = '__release_bubble_area__';
const DEFAULT_BUBBLE_SIZE = 14;

// "padding" around the bubbles as it is drawn on canvas vs CSS, this may need
// to move into `renderReleaseBubble` if it needs to be customizable
const RELEASE_BUBBLE_Y_PADDING = 8;
const RELEASE_BUBBLE_Y_HALF_PADDING = RELEASE_BUBBLE_Y_PADDING / 2;
const RELEASE_BUBBLE_X_PADDING = 2;
const RELEASE_BUBBLE_X_HALF_PADDING = RELEASE_BUBBLE_X_PADDING / 2;

interface CreateReleaseBubbleMouseListenersParams {
  buckets: Bucket[];
  color: string;
  openDrawer: (
    renderer: DrawerConfig['renderer'],
    options: DrawerConfig['options']
  ) => void;
  chartRenderer?: (
    rendererProps: Partial<TimeSeriesWidgetVisualizationProps>
  ) => ReactElement;
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

      const {data} = params;

      // "Full Screen View" for Insights opens in a modal, close before opening
      // drawer.
      closeModal();

      openDrawer(
        () => (
          <ReleasesDrawer
            startTs={data[0]}
            endTs={data[2]}
            releases={data[4]}
            buckets={buckets}
            chartRenderer={chartRenderer}
          />
        ),
        {
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
    },
  };
}

interface ReleaseBubbleSeriesProps {
  buckets: Bucket[];
  chartRef: React.RefObject<ReactEchartsRef>;
  releases: ReleaseMetaBasic[];
  theme: Theme;
  bubbleSize?: number;
}

/**
 * Creates a series item that is used to draw the release bubbles in a chart
 */
function ReleaseBubbleSeries({
  buckets,
  chartRef,
  theme,
  bubbleSize = DEFAULT_BUBBLE_SIZE,
}: ReleaseBubbleSeriesProps): CustomSeriesOption | null {
  const totalReleases = buckets.reduce(
    (acc, [, , , numReleases]) => acc + numReleases,
    0
  );
  const avgReleases = totalReleases / buckets.length;
  /**
   * Renders release bubbles underneath the main chart
   */
  const renderReleaseBubble: CustomSeriesRenderItem = (
    _params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
  ) => {
    // api.value(index) returns the value at Bucket[index]
    // Unfortunately, it seems only integer values are allowed, it'll otherwise
    // return NaN (this could be due to the chart being a timeseries).
    //
    // Because we are drawing rectangles with a known height, we don't care
    // about the y-value (which I think is the 2nd tuple value passed to
    // `api.coord()`).
    const [bubbleStartX, bubbleStartY] = api.coord([api.value(0), 0]);
    const [bubbleEndX, bubbleEndY] = api.coord([api.value(2), 0]);

    if (
      !defined(bubbleStartX) ||
      !defined(bubbleStartY) ||
      !defined(bubbleEndX) ||
      !defined(bubbleEndY)
    ) {
      return null;
    }

    const numberReleases = api.value(3);

    // Width between two timestamps for timeSeries
    const width = bubbleEndX - bubbleStartX;

    //
    const shape = {
      x: bubbleStartX + RELEASE_BUBBLE_X_HALF_PADDING,
      y: bubbleStartY + RELEASE_BUBBLE_Y_HALF_PADDING,
      width: width - RELEASE_BUBBLE_X_PADDING,
      // currently we have a static height, but this may need to change since
      // we have charts of different dimensions
      height: bubbleSize - RELEASE_BUBBLE_Y_PADDING,

      // border radius
      r: 4,
    };

    return {
      type: 'rect',
      transition: ['shape'],
      shape,
      style: {
        fill: theme.blue400,
        // TODO: figure out correct opacity calculations
        opacity: Math.round((Number(numberReleases) / avgReleases) * 50) / 100,
      },
      emphasis: {
        style: {
          stroke: theme.blue300,
        },
      },
    } satisfies CustomSeriesRenderItemReturn;
  };

  return {
    id: BUBBLE_SERIES_ID,
    type: 'custom',
    renderItem: renderReleaseBubble,
    data: buckets,
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
        const numberReleases = Number(bucket[3]);
        return `
<div class="tooltip-series">
<div>
${numberReleases} Releases
</div>
</div>

${
  numberReleases > 0
    ? `<div class="tooltip-footer">
Tap to view
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
   * Color of the highlighted area in main chart when mousehovers over a bubble
   */
  highlightAreaColor: string;
  theme: Theme;
  bubbleSize?: number;
  chartRenderer?: (rendererProps: Partial<TimeSeriesWidgetVisualizationProps>) => any;
  maxTime?: number;
  minTime?: number;
  /**
   * This is a ref callback function that is called on mount/unmount.
   */
  onChartMount?: (e: ReactEchartsRef) => void;
  releases?: ReleaseMetaBasic[];
}
export function useReleaseBubbles({
  chartRenderer,
  highlightAreaColor,
  releases,
  minTime,
  maxTime,
  theme,
  bubbleSize,
  onChartMount,
}: UseReleaseBubblesParams) {
  const organization = useOrganization();
  const highlighterCleanupRef = useRef<(() => void) | null>(null);
  const {openDrawer} = useDrawer();
  const chartRef = useRef<EChartsReactCore | null>(null);
  const hasReleaseBubbles = organization.features.includes('release-bubbles-ui');
  const buckets =
    (hasReleaseBubbles &&
      releases?.length &&
      minTime &&
      maxTime &&
      createReleaseBuckets(minTime, maxTime, releases)) ||
    [];

  useEffect(() => {
    // Cleanup highlighter on unmount
    const cleanupFn = highlighterCleanupRef.current;
    return () => {
      if (typeof cleanupFn === 'function') {
        cleanupFn();
      }
    };
  }, []);

  const handleChartMount = useCallback(
    (e: ReactEchartsRef) => {
      // Need to call this regardless of `hasReleaseBubbles`, since this hook
      // needs to act as a proxy to capture the chart ref.
      onChartMount?.(e);

      chartRef.current = e;

      if (!e?.getEchartsInstance) {
        return;
      }

      if (hasReleaseBubbles) {
        highlighterCleanupRef.current = createReleaseBubbleHighlighter(
          e.getEchartsInstance()
        );
      }
    },
    [hasReleaseBubbles, onChartMount]
  );

  if (!releases || !buckets.length) {
    return {
      handleChartMount,
      releaseBubbleEventHandlers: {},
      ReleaseBubbleSeries: null,
      releaseBubbleXAxis: {},
      releaseBubbleGrid: {},
    };
  }

  return {
    handleChartMount,

    /**
     * An object map of eCharts event handlers. These should be spread onto a Chart component
     */
    releaseBubbleEventHandlers: createReleaseBubbleMouseListeners({
      buckets,
      chartRenderer,
      color: highlightAreaColor,
      openDrawer,
    }),

    /**
     * Series to append to a chart's existing `series`
     */
    releaseBubbleSeries: ReleaseBubbleSeries({
      buckets,
      bubbleSize,
      chartRef,
      theme,
      releases,
    }),

    /**
     * eCharts xAxis configuration. Spread/override charts `xAxis` prop
     */
    releaseBubbleXAxis: {
      // configure `axisLine` and `offset` to move axis line below 0 so that
      // bubbles sit between bottom of the main chart and the axis line
      axisLine: {onZero: false},
      offset: bubbleSize,
    },

    /**
     * eCharts grid configuration. Spread/override charts `grid` prop
     */
    releaseBubbleGrid: {
      // Moves bottom of grid "up" `bubbleSize` pixels so that bubbles are
      // drawn below grid (but above x axis label)
      bottom: bubbleSize,
    },
  };
}
