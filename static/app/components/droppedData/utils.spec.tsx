import {AnnotationFixture} from 'sentry-fixture/annotation';

import {annotationsToCategorySections, groupIntoBuckets, opacityForRatio} from './utils';

describe('groupIntoBuckets', () => {
  it('returns an empty array for no annotations', () => {
    expect(groupIntoBuckets([])).toEqual([]);
  });

  it('collapses annotations sharing a (start, end) and sums eventCount', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({
        start: 0,
        end: 60_000,
        eventCount: 10,
        reason: 'rate_limited',
      }),
      AnnotationFixture({start: 0, end: 60_000, eventCount: 5, reason: 'quota'}),
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.dropped.eventCount).toBe(15);
    expect(buckets[0]!.annotations).toHaveLength(2);
    expect(buckets[0]!.start).toBe(0);
    expect(buckets[0]!.end).toBe(60_000);
  });

  it('keeps distinct (start, end) ranges as separate buckets', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({start: 0, end: 60_000, eventCount: 10}),
      AnnotationFixture({start: 60_000, end: 120_000, eventCount: 20}),
    ]);

    expect(buckets).toHaveLength(2);
    expect(buckets.map(bucket => bucket.dropped.eventCount)).toEqual([10, 20]);
  });

  it('excludes configured drops', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({
        outcome: 'client_discard',
        reason: 'before_send',
        eventCount: 100,
      }),
      AnnotationFixture({
        outcome: 'client_discard',
        reason: 'sample_rate',
        eventCount: 100,
      }),
      AnnotationFixture({
        outcome: 'filtered',
        reason: 'web-crawlers',
        eventCount: 100,
      }),
      AnnotationFixture({
        outcome: 'filtered',
        reason: 'legacy-browsers',
        eventCount: 100,
      }),
      AnnotationFixture({
        outcome: 'filtered',
        reason: 'filtered-transaction',
        eventCount: 100,
      }),
      AnnotationFixture({
        outcome: 'rate_limited',
        reason: 'generic',
        eventCount: 10,
      }),
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.dropped.eventCount).toBe(10);
  });

  it('keeps client discards the SDK did not choose', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({
        outcome: 'client_discard',
        reason: 'queue_overflow',
        eventCount: 7,
      }),
      AnnotationFixture({
        outcome: 'client_discard',
        reason: 'network_error',
        eventCount: 3,
      }),
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.dropped.eventCount).toBe(10);
  });

  it('keeps an unrecognized reason under a server-side outcome', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({
        outcome: 'invalid',
        reason: 'some_new_reason',
        eventCount: 4,
      }),
    ]);

    expect(buckets[0]!.dropped.eventCount).toBe(4);
  });

  it('subtotals dropped volume by outcome, largest first', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({outcome: 'invalid', eventCount: 3}),
      AnnotationFixture({outcome: 'rate_limited', eventCount: 10}),
      AnnotationFixture({outcome: 'invalid', eventCount: 4, reason: 'cors'}),
    ]);

    expect(buckets[0]!.byOutcome).toEqual([
      expect.objectContaining({outcome: 'rate_limited', eventCount: 10}),
      expect.objectContaining({outcome: 'invalid', eventCount: 7}),
    ]);
  });

  it('joins accepted volume by start', () => {
    const buckets = groupIntoBuckets(
      [AnnotationFixture({start: 0, end: 60_000, eventCount: 10})],
      [
        AnnotationFixture({start: 0, end: 60_000, eventCount: 90, outcome: 'accepted'}),
        AnnotationFixture({
          start: 60_000,
          end: 120_000,
          eventCount: 500,
          outcome: 'accepted',
        }),
      ]
    );

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.accepted.eventCount).toBe(90);
    expect(buckets[0]!.ratio).toBe(0.1);
  });

  it('treats a missing accepted annotation as zero accepted volume', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({start: 0, end: 60_000, eventCount: 10}),
    ]);

    expect(buckets[0]!.accepted.eventCount).toBe(0);
    expect(buckets[0]!.ratio).toBe(1);
  });

  it('sums byteSize only for annotations that report it', () => {
    const [withBytes] = groupIntoBuckets(
      [
        AnnotationFixture({start: 0, eventCount: 10, byteSize: 400}),
        AnnotationFixture({start: 0, eventCount: 5, byteSize: 100, reason: 'quota'}),
      ],
      [AnnotationFixture({start: 0, eventCount: 90, byteSize: 9_500})]
    );

    expect(withBytes!.dropped.byteSize).toBe(500);
    expect(withBytes!.accepted.byteSize).toBe(9_500);

    const [withoutBytes] = groupIntoBuckets([
      AnnotationFixture({start: 0, eventCount: 10}),
    ]);

    expect(withoutBytes!.dropped.byteSize).toBeUndefined();
  });

  it('maps drop ratio continuously onto opacity', () => {
    expect(opacityForRatio(0)).toBe(0);
    expect(opacityForRatio(0.01)).toBeCloseTo(0.167);
    expect(opacityForRatio(0.02)).toBeCloseTo(0.184);
    expect(opacityForRatio(0.5)).toBe(1);
    expect(opacityForRatio(1)).toBe(1);
  });
});

describe('annotationsToCategorySections', () => {
  it('returns no sections for no dropped annotations', () => {
    expect(annotationsToCategorySections([], [])).toEqual([]);
  });

  it('groups by outcome then reason, labeling the outcome', () => {
    const sections = annotationsToCategorySections(
      [
        AnnotationFixture({outcome: 'invalid', reason: 'cors', start: 0, eventCount: 5}),
        AnnotationFixture({
          outcome: 'invalid',
          reason: 'timestamp',
          start: 0,
          eventCount: 3,
        }),
        AnnotationFixture({
          outcome: 'filtered',
          reason: 'web-crawlers',
          start: 0,
          eventCount: 1,
        }),
      ],
      []
    );

    expect(sections.map(s => s.label)).toEqual([
      'Invalid or malformed',
      'Inbound filter',
    ]);
    expect(sections[0]!.events).toBe(8);
    expect(sections[0]!.reasons.map(r => r.reason)).toEqual(['cors', 'timestamp']);
  });

  it('counts distinct buckets a reason appears in', () => {
    const sections = annotationsToCategorySections(
      [
        AnnotationFixture({outcome: 'invalid', reason: 'cors', start: 0, eventCount: 2}),
        AnnotationFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 60_000,
          eventCount: 4,
        }),
        AnnotationFixture({outcome: 'invalid', reason: 'cors', start: 0, eventCount: 1}),
      ],
      []
    );

    const cors = sections[0]!.reasons[0]!;
    expect(cors.droppedBuckets).toBe(2);
    expect(cors.events).toBe(7);
  });

  it('computes share against total events (accepted + dropped)', () => {
    const sections = annotationsToCategorySections(
      [AnnotationFixture({outcome: 'invalid', reason: 'cors', start: 0, eventCount: 25})],
      [
        AnnotationFixture({
          outcome: 'accepted',
          reason: 'accepted',
          start: 0,
          eventCount: 75,
        }),
      ]
    );

    expect(sections[0]!.shareRatio).toBe(0.25);
    expect(sections[0]!.reasons[0]!.shareRatio).toBe(0.25);
  });

  it('guards divide-by-zero when there are no events', () => {
    const sections = annotationsToCategorySections(
      [AnnotationFixture({outcome: 'invalid', reason: 'cors', start: 0, eventCount: 0})],
      []
    );

    expect(sections[0]!.shareRatio).toBe(0);
    expect(sections[0]!.reasons[0]!.shareRatio).toBe(0);
  });

  it('tracks the latest bucket end as lastSeen', () => {
    const sections = annotationsToCategorySections(
      [
        AnnotationFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 0,
          end: 60_000,
          eventCount: 1,
        }),
        AnnotationFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 120_000,
          end: 180_000,
          eventCount: 1,
        }),
      ],
      []
    );

    expect(sections[0]!.reasons[0]!.lastSeen).toBe(180_000);
  });

  it('clamps lastSeen to now for an in-progress bucket ending in the future', () => {
    const now = 100_000;
    const sections = annotationsToCategorySections(
      [
        AnnotationFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 60_000,
          end: 120_000,
          eventCount: 1,
        }),
      ],
      [],
      now
    );

    expect(sections[0]!.reasons[0]!.lastSeen).toBe(now);
  });
});
