import type {ReactElement} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from 'echarts';
import type {EChartsInstance} from 'echarts-for-react';

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
import {
  BUBBLE_AREA_SERIES_ID,
  BUBBLE_SERIES_ID,
  DEFAULT_BUBBLE_SIZE,
  RELEASE_BUBBLE_X_HALF_PADDING,
  RELEASE_BUBBLE_X_PADDING,
  RELEASE_BUBBLE_Y_HALF_PADDING,
  RELEASE_BUBBLE_Y_PADDING,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/constants';
import {createReleaseBubbleHighlighter} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/createReleaseBubbleHighlighter';
import type {Bucket} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/types';
import {createReleaseBuckets} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/utils/createReleaseBuckets';

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
            endTs={data.end}
            releases={data.releases}
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
  const totalReleases = buckets.reduce((acc, {releases}) => acc + releases.length, 0);
  const avgReleases = totalReleases / buckets.length;
  const data = buckets.map(({start, end, releases}) => ({
    value: [start, 0, end, releases.length],
    start,
    end,
    releases,
  }));

  /**
   * Renders release bubbles underneath the main chart
   */
  const renderReleaseBubble: CustomSeriesRenderItem = (
    _params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
  ) => {
    const dataItem = data[_params.dataIndex];

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
    data,
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
  chartRef: React.RefObject<ReactEchartsRef>;
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
  chartRef,
  chartRenderer,
  releases,
  minTime,
  maxTime,
  bubbleSize,
}: UseReleaseBubblesParams) {
  const organization = useOrganization();
  const {openDrawer} = useDrawer();
  const theme = useTheme();
  const hasReleaseBubbles = organization.features.includes('release-bubbles-ui');
  const buckets =
    (hasReleaseBubbles &&
      releases?.length &&
      minTime &&
      maxTime &&
      createReleaseBuckets(minTime, maxTime, releases)) ||
    [];

  if (!releases || !buckets.length) {
    return {
      createReleaseBubbleHighlighter: () => {},
      releaseBubbleEventHandlers: {},
      ReleaseBubbleSeries: null,
      releaseBubbleXAxis: {},
      releaseBubbleGrid: {},
    };
  }

  return {
    createReleaseBubbleHighlighter,

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
      chartRef,
      theme,
      releases,
    }),

    /**
     * ECharts xAxis configuration. Spread/override charts `xAxis` prop
     */
    releaseBubbleXAxis: {
      // configure `axisLine` and `offset` to move axis line below 0 so that
      // bubbles sit between bottom of the main chart and the axis line
      axisLine: {onZero: false},
      offset: bubbleSize,
    },

    /**
     * ECharts grid configuration. Spread/override charts `grid` prop
     */
    releaseBubbleGrid: {
      // Moves bottom of grid "up" `bubbleSize` pixels so that bubbles are
      // drawn below grid (but above x axis label)
      bottom: bubbleSize,
    },
  };
}
