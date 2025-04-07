import type {ElementEvent} from 'echarts';
import type {EChartsInstance} from 'echarts-for-react';
import debounce from 'lodash/debounce';

import {t} from 'sentry/locale';
import type {
  EChartClickHandler,
  EChartMouseOutHandler,
  EChartMouseOverHandler,
  Series,
} from 'sentry/types/echarts';
import {trackAnalytics} from 'sentry/utils/analytics';
import {ReleasesDrawer} from 'sentry/views/releases/drawer/releasesDrawer';
import {
  BUBBLE_AREA_SERIES_ID,
  BUBBLE_SERIES_ID,
} from 'sentry/views/releases/releaseBubbles/constants';
import type {Bucket} from 'sentry/views/releases/releaseBubbles/types';

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

/**
 * Attaches an event listener to eCharts that will "highlight" a release bubble
 * as the mouse moves around the main chart.
 *
 * Note: you cannot listen to "mousemove" events on echarts as they only
 * contain events when the mouse interacts with a data item. This needs to
 * listen to zrender (i.e. the `getZr()`) events.
 */
export function createReleaseBubbleEventListeners(
  echartsInstance: EChartsInstance,
  opts
) {
  const {
    legendSelected,
    releaseBubbleXAxis,
    releaseBubbleGrid,
    defaultBubbleXAxis,
    defaultBubbleGrid,
    theme,
    alignInMiddle,
    closeModal,
    openDrawer,
    buckets,
    projects,
    environments,
    chartRenderer,
  } = opts;
  const highlightedBuckets = new Set();
  function handleMouseMove(params: ElementEvent) {
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

    if (!buckets) {
      return;
    }

    // Try to find the bucket that the mouse is hovered over
    const bucketIndex = bucketsFromSeries.findIndex(({start, end}: Bucket) => {
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
  }

  const handleSeriesClick: EChartClickHandler = params => {
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
  };

  const handleMouseOver: EChartMouseOverHandler = params => {
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

  const handleMouseOut: EChartMouseOutHandler = params => {
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
}
