import {AnnotationFixture} from 'sentry-fixture/annotation';

import {type AnnotationBucket, groupIntoBuckets, MAX_SEVERITY} from './utils';

describe('groupIntoBuckets', () => {
  it('returns an empty array for no annotations', () => {
    expect(groupIntoBuckets([])).toEqual([]);
  });

  it('collapses annotations sharing a (start, end) and sums eventCount', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({start: 0, end: 60_000, eventCount: 10, reason: 'rate_limited'}),
      AnnotationFixture({start: 0, end: 60_000, eventCount: 5, reason: 'quota'}),
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.droppedTotal).toBe(15);
    expect(buckets[0]!.start).toBe(0);
    expect(buckets[0]!.end).toBe(60_000);
  });

  it('keeps distinct (start, end) ranges as separate buckets', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({start: 0, end: 60_000, eventCount: 10}),
      AnnotationFixture({start: 60_000, end: 120_000, eventCount: 20}),
    ]);

    expect(buckets).toHaveLength(2);
    expect(buckets.map((bucket: AnnotationBucket) => bucket.droppedTotal)).toEqual([
      10, 20,
    ]);
  });

  it('assigns MAX_SEVERITY to the bucket with the largest total', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({start: 0, end: 60_000, eventCount: 100}),
      AnnotationFixture({start: 60_000, end: 120_000, eventCount: 26}),
    ]);

    const [worst, lesser] = buckets;
    expect(worst!.droppedTotal).toBe(100);
    expect(worst!.severity).toBe(MAX_SEVERITY);
    // (26 / 100) * 4 = 1.04 -> ceil -> 2
    expect(lesser!.severity).toBe(2);
  });
});
