import {useCallback, useLayoutEffect, useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';

import type {BandBucket} from './bandShapes';

const BARS_PER_BUCKET_STEPS = [1, 2, 4, 8, 16];
const MAX_BARS_PER_BUCKET = 16;
const MIN_BUCKET_WIDTH = 12;

/**
 * How many bars an annotation bucket spans before the chart has been measured.
 */
export function barsPerBucketForCount(barCount: number): number {
  if (barCount < 100) {
    return 1;
  }
  if (barCount < 150) {
    return 2;
  }
  if (barCount < 300) {
    return 4;
  }
  return 8;
}

/**
 * The fewest bars an annotation bucket can span and still be
 * `MIN_BUCKET_WIDTH` pixels wide, so buckets stay as fine as the chart's width
 * allows.
 */
export function barsPerBucketForWidth(barCount: number, width: number): number {
  const barWidth = width / barCount;
  return (
    BARS_PER_BUCKET_STEPS.find(bars => bars * barWidth >= MIN_BUCKET_WIDTH) ??
    MAX_BARS_PER_BUCKET
  );
}

/**
 * Merges every `barsPerBucket` bars into one bucket. Groups start at fixed
 * multiples of their duration rather than at the first bar, so they keep
 * their place when the chart's time range moves, and the buckets on either
 * end can span fewer bars. `bars` must be sorted by `start`.
 */
export function groupBars(bars: BandBucket[], barsPerBucket: number): BandBucket[] {
  const [firstBar] = bars;
  if (!firstBar || barsPerBucket <= 1) {
    return bars;
  }

  const barInterval = firstBar.end - firstBar.start;
  const duration = barInterval * barsPerBucket;
  const alignment = firstBar.start % barInterval;

  const buckets: BandBucket[] = [];
  let groupStart: number | undefined;
  for (const bar of bars) {
    const start = Math.floor((bar.start - alignment) / duration) * duration + alignment;
    const bucket = buckets.at(-1);
    if (bucket && start === groupStart) {
      bucket.end = bar.end;
    } else {
      buckets.push({start: bar.start, end: bar.end});
      groupStart = start;
    }
  }
  return buckets;
}

/**
 * How many of a chart's `barCount` bars each annotation bucket spans, based
 * on the width of the element holding the chart. Only changes when the width
 * crosses a step, so resizing doesn't redraw the chart on every pixel.
 */
export function useBarsPerAnnotationBucket(
  ref: React.RefObject<HTMLElement | null>,
  barCount: number
): number {
  const [barsPerBucket, setBarsPerBucket] = useState(() =>
    barsPerBucketForCount(barCount)
  );

  const measure = useCallback(() => {
    const width = ref.current?.clientWidth;
    setBarsPerBucket(
      width ? barsPerBucketForWidth(barCount, width) : barsPerBucketForCount(barCount)
    );
  }, [barCount, ref]);

  useLayoutEffect(measure, [measure]);
  useResizeObserver({ref, onResize: measure});

  return barsPerBucket;
}
