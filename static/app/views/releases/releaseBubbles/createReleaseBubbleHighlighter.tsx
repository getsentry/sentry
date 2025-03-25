import type {ElementEvent} from 'echarts';
import type {EChartsInstance} from 'echarts-for-react';
import debounce from 'lodash/debounce';

import type {Series} from 'sentry/types/echarts';
import {trackAnalytics} from 'sentry/utils/analytics';
import {BUBBLE_SERIES_ID} from 'sentry/views/releases/releaseBubbles/constants';
import type {Bucket} from 'sentry/views/releases/releaseBubbles/types';

interface LegendSelectChangedParams {
  name: string;
  selected: Record<string, boolean>;
}

interface Callbacks {
  /**
   * Callback for when the Releases legend item is changed
   */
  onLegendChange: (selected: boolean) => void;
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
export function createReleaseBubbleHighlighter(
  echartsInstance: EChartsInstance,
  {onLegendChange}: Callbacks
) {
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
    const buckets = bubbleSeries?.data;

    if (!buckets) {
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
  }

  echartsInstance.getZr().on('mousemove', handleMouseMove);

  echartsInstance.on('legendselectchanged', (params: LegendSelectChangedParams) => {
    if (params.name !== 'Releases' || !('Releases' in params.selected)) {
      return;
    }

    onLegendChange(params.selected.Releases);

    trackLegend(params);
  });

  // This fixes a bug where if you hover over a bubble and mouseout via xaxis
  // (i.e. bottom of chart), the bubble will remain highlighted. This makes it
  // look buggy and can be misleading especially for bubbles w/ 0 releases.
  echartsInstance.on('globalout', () => {
    const series = echartsInstance.getOption().series;
    const seriesIndex = series.findIndex((s: Series) => s.id === BUBBLE_SERIES_ID);
    // We could find and include a `dataIndex` to be specific about which
    // bubble to "downplay", but I think it's ok to downplay everything
    echartsInstance.dispatchAction({
      type: 'downplay',
      seriesIndex,
    });
  });
}
