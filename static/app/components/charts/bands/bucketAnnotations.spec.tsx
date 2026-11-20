import type {AnnotationItem} from 'sentry/components/charts/annotations/types';

import {bucketAnnotations} from './bucketAnnotations';

const HOUR = 60 * 60 * 1000;
const START = new Date('2026-11-03T12:00:00Z').getTime();

const buckets = [0, 1, 2].map(index => ({
  start: START + index * HOUR,
  end: START + (index + 1) * HOUR,
}));

function release(version: string, offset: number): AnnotationItem {
  return {id: version, kind: 'release', start: START + offset, title: version};
}

describe('bucketAnnotations', () => {
  it('returns every bucket, with or without annotations', () => {
    const first = release('1.0.0', 10 * 60 * 1000);
    const second = release('1.0.1', 50 * 60 * 1000);
    const third = release('1.1.0', 2 * HOUR + 5 * 60 * 1000);

    expect(bucketAnnotations([third, first, second], buckets)).toEqual([
      {...buckets[0], items: [first, second]},
      {...buckets[1], items: []},
      {...buckets[2], items: [third]},
    ]);
  });

  it('includes the bucket start and excludes the bucket end', () => {
    const atStart = release('1.0.0', HOUR);
    const atEnd = release('1.0.1', 2 * HOUR);

    expect(bucketAnnotations([atStart, atEnd], buckets)).toEqual([
      {...buckets[0], items: []},
      {...buckets[1], items: [atStart]},
      {...buckets[2], items: [atEnd]},
    ]);
  });

  it('leaves out annotations outside every bucket', () => {
    const before = release('0.9.0', -1);
    const after = release('2.0.0', 3 * HOUR);

    expect(bucketAnnotations([before, after], buckets)).toEqual(
      buckets.map(bucket => ({...bucket, items: []}))
    );
  });
});
