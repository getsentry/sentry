import sortedLastIndex from 'lodash/sortedLastIndex';

import type {AnnotationItem} from 'sentry/components/charts/annotations/types';

import type {BandBucket} from './bandShapes';

export interface AnnotationBucket extends BandBucket {
  items: AnnotationItem[];
}

/**
 * Puts each annotation in the chart bucket it starts in, so annotation buckets
 * line up with the other bands. `buckets` must be sorted by `start`. Every
 * bucket is returned, including those without annotations, and annotations
 * outside every bucket are left out.
 */
export function bucketAnnotations(
  items: readonly AnnotationItem[],
  buckets: readonly BandBucket[]
): AnnotationBucket[] {
  const starts = buckets.map(bucket => bucket.start);
  const itemsByBucket = new Map<number, AnnotationItem[]>();

  for (const item of items) {
    const index = sortedLastIndex(starts, item.start) - 1;
    const bucket = buckets[index];
    if (!bucket || item.start >= bucket.end) {
      continue;
    }

    const itemsInBucket = itemsByBucket.get(index) ?? [];
    itemsInBucket.push(item);
    itemsByBucket.set(index, itemsInBucket);
  }

  return buckets.map((bucket, index) => ({
    ...bucket,
    items: itemsByBucket.get(index) ?? [],
  }));
}
