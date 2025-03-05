import type {ElementEvent} from 'echarts';
import type {EChartsInstance} from 'echarts-for-react';

import type {Series} from 'sentry/types/echarts';
import {BUBBLE_SERIES_ID} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/constants';
import type {Bucket} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/types';

/**
 * Attaches an event listener to eCharts that will "highlight" a release bubble
 * as the mouse moves around the main chart.
 *
 * Note: you cannot listen to "mousemove" events on echarts as they only
 * contain events when the mouse interacts with a data item. This needs to
 * listen to zrender (i.e. the `getZr()`) events.
 */
export function createReleaseBubbleHighlighter(echartsInstance: EChartsInstance) {
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

    const bucketIndex = buckets.findIndex(({start, end}: Bucket) => {
      const ts = pointInGrid[0] ?? -1;
      return ts >= start && ts < end;
    });

    // Already highlighted, no need to do anything
    if (highlightedBuckets.has(bucketIndex)) {
      return;
    }

    // If next bucket is not already highlighted, clear all existing
    // highlights.
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
}
