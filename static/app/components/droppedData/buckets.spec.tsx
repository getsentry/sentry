import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {groupIntoBuckets, hasDroppedData} from './buckets';

describe('hasDroppedData', () => {
  function hasDrops(dropped: number, accepted: number) {
    return hasDroppedData(
      [DroppedEventFixture({start: 0, count: dropped})],
      [DroppedEventFixture({start: 0, count: accepted})]
    );
  }

  it('is true when there is at least one dropped event', () => {
    expect(hasDroppedData([DroppedEventFixture()])).toBe(true);
  });

  it('is false for missing or empty events', () => {
    expect(hasDroppedData(undefined)).toBe(false);
    expect(hasDroppedData([])).toBe(false);
  });

  it('is false when every drop is configured', () => {
    expect(
      hasDroppedData([
        DroppedEventFixture({outcome: 'client_discard', reason: 'sample_rate'}),
        DroppedEventFixture({outcome: 'filtered', reason: 'web-crawlers'}),
      ])
    ).toBe(false);
  });

  it('is true only when a bucket has dropped events', () => {
    expect(hasDrops(0, 100)).toBe(false);
    expect(hasDrops(1, 99)).toBe(true);
  });

  it('ignores buckets whose drop ratio is below 0.1%', () => {
    expect(hasDrops(1, 1999)).toBe(false);
    expect(hasDrops(1, 999)).toBe(true);
  });
});

describe('groupIntoBuckets', () => {
  it('returns an empty array for no events', () => {
    expect(groupIntoBuckets([])).toEqual([]);
  });

  it('collapses events sharing a (start, end) and sums count', () => {
    const buckets = groupIntoBuckets([
      DroppedEventFixture({
        start: 0,
        end: 60_000,
        count: 10,
        reason: 'rate_limited',
      }),
      DroppedEventFixture({start: 0, end: 60_000, count: 5, reason: 'quota'}),
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.dropped.count).toBe(15);
    expect(buckets[0]!.events).toHaveLength(2);
    expect(buckets[0]!.start).toBe(0);
    expect(buckets[0]!.end).toBe(60_000);
  });

  it('keeps distinct (start, end) ranges as separate buckets', () => {
    const buckets = groupIntoBuckets([
      DroppedEventFixture({start: 0, end: 60_000, count: 10}),
      DroppedEventFixture({start: 60_000, end: 120_000, count: 20}),
    ]);

    expect(buckets).toHaveLength(2);
    expect(buckets.map(bucket => bucket.dropped.count)).toEqual([10, 20]);
  });

  it.each([
    ['client_discard', 'before_send'],
    ['client_discard', 'event_processor'],
    ['client_discard', 'ignored'],
    ['client_discard', 'no_parent_span'],
    ['client_discard', 'sample_rate'],
    ['client_sampled', 'sample_rate'],
    ['filtered', 'web-crawlers'],
    ['filtered', 'custom-inbound-filter:123'],
    ['invalid', 'cors'],
    ['invalid', 'missing_signature'],
    ['invalid', 'transaction_sampled'],
    ['rate_limited', 'key_quota'],
  ])('excludes configured %s drops with reason %s', (outcome, reason) => {
    expect(groupIntoBuckets([DroppedEventFixture({outcome, reason})])).toEqual([
      expect.objectContaining({dropped: {count: 0}, events: [], ratio: 0}),
    ]);
  });

  it.each([
    ['client_discard', 'queue_overflow'],
    ['client_discard', 'network_error'],
    ['invalid', 'timestamp'],
    ['invalid', 'too_large:transaction'],
    ['rate_limited', 'generic'],
    ['rate_limited', 'span_usage_exceeded'],
  ])('keeps unintentional %s drops with reason %s', (outcome, reason) => {
    const buckets = groupIntoBuckets([DroppedEventFixture({outcome, reason, count: 7})]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.dropped.count).toBe(7);
  });

  it('keeps an unrecognized reason under a server-side outcome', () => {
    const buckets = groupIntoBuckets([
      DroppedEventFixture({
        outcome: 'invalid',
        reason: 'some_new_reason',
        count: 4,
      }),
    ]);

    expect(buckets[0]!.dropped.count).toBe(4);
  });

  it('subtotals dropped volume by outcome, largest first', () => {
    const buckets = groupIntoBuckets([
      DroppedEventFixture({outcome: 'invalid', count: 3}),
      DroppedEventFixture({outcome: 'rate_limited', count: 10}),
      DroppedEventFixture({outcome: 'invalid', count: 4, reason: 'timestamp'}),
    ]);

    expect(buckets[0]!.byOutcome).toEqual([
      expect.objectContaining({outcome: 'rate_limited', count: 10}),
      expect.objectContaining({outcome: 'invalid', count: 7}),
    ]);
  });

  it('joins accepted volume by start', () => {
    const buckets = groupIntoBuckets(
      [DroppedEventFixture({start: 0, end: 60_000, count: 10})],
      [
        DroppedEventFixture({start: 0, end: 60_000, count: 90, outcome: 'accepted'}),
        DroppedEventFixture({
          start: 60_000,
          end: 120_000,
          count: 500,
          outcome: 'accepted',
        }),
      ]
    );

    expect(buckets[0]!.accepted.count).toBe(90);
    expect(buckets[0]!.ratio).toBe(0.1);
  });

  it('treats a missing accepted event as zero accepted volume', () => {
    const buckets = groupIntoBuckets([
      DroppedEventFixture({start: 0, end: 60_000, count: 10}),
    ]);

    expect(buckets[0]!.accepted.count).toBe(0);
    expect(buckets[0]!.ratio).toBe(1);
  });

  it('keeps time ranges without unintentional drops as zero-ratio buckets', () => {
    const buckets = groupIntoBuckets(
      [
        DroppedEventFixture({start: 0, end: 60_000, count: 10}),
        DroppedEventFixture({
          start: 120_000,
          end: 180_000,
          outcome: 'filtered',
          reason: 'web-crawlers',
        }),
      ],
      [
        DroppedEventFixture({start: 0, end: 60_000, count: 90, outcome: 'accepted'}),
        DroppedEventFixture({
          start: 60_000,
          end: 120_000,
          count: 30,
          outcome: 'accepted',
        }),
        DroppedEventFixture({
          start: 60_000,
          end: 120_000,
          count: 20,
          outcome: 'accepted',
        }),
      ]
    );

    expect(buckets).toEqual([
      expect.objectContaining({start: 0, ratio: 0.1}),
      expect.objectContaining({
        start: 60_000,
        end: 120_000,
        ratio: 0,
        accepted: {count: 50},
        dropped: {count: 0},
        byOutcome: [],
      }),
      expect.objectContaining({start: 120_000, end: 180_000, ratio: 0}),
    ]);
  });
});
