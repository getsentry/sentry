import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';

import {groupIntoBuckets, hasDroppedData} from './buckets';

describe('hasDroppedData', () => {
  function hasDrops(dropped: number, accepted: number) {
    return hasDroppedData(
      [OutcomeRowFixture({start: 0, count: dropped})],
      [OutcomeRowFixture({start: 0, count: accepted})]
    );
  }

  it('is true when any drop is unintentional', () => {
    expect(
      hasDroppedData([
        OutcomeRowFixture({tags: ['intentional']}),
        OutcomeRowFixture({tags: ['unintentional']}),
      ])
    ).toBe(true);
  });

  it('is false when every drop is intentional', () => {
    expect(hasDroppedData([OutcomeRowFixture({tags: ['intentional']})])).toBe(false);
  });

  it('is false for missing or empty events', () => {
    expect(hasDroppedData(undefined)).toBe(false);
    expect(hasDroppedData([])).toBe(false);
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
      OutcomeRowFixture({
        start: 0,
        end: 60_000,
        count: 10,
        reason: 'rate_limited',
      }),
      OutcomeRowFixture({start: 0, end: 60_000, count: 5, reason: 'quota'}),
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.dropped).toBe(15);
    expect(buckets[0]!.start).toBe(0);
    expect(buckets[0]!.end).toBe(60_000);
  });

  it('keeps distinct (start, end) ranges as separate buckets', () => {
    const buckets = groupIntoBuckets([
      OutcomeRowFixture({start: 0, end: 60_000, count: 10}),
      OutcomeRowFixture({start: 60_000, end: 120_000, count: 20}),
    ]);

    expect(buckets).toHaveLength(2);
    expect(buckets.map(bucket => bucket.dropped)).toEqual([10, 20]);
  });

  it('excludes intentional drops', () => {
    expect(groupIntoBuckets([OutcomeRowFixture({tags: ['intentional']})])).toEqual([
      expect.objectContaining({dropped: 0, ratio: 0}),
    ]);
  });

  it('counts only unintentional drops when a bucket has both', () => {
    const buckets = groupIntoBuckets(
      [
        OutcomeRowFixture({count: 10, tags: ['unintentional']}),
        OutcomeRowFixture({count: 30, tags: ['intentional']}),
      ],
      [OutcomeRowFixture({count: 90, outcome: 'accepted', tags: []})]
    );

    expect(buckets).toEqual([
      expect.objectContaining({
        dropped: 10,
        ratio: 0.1,
      }),
    ]);
  });

  it('subtotals dropped volume by outcome, largest first', () => {
    const buckets = groupIntoBuckets([
      OutcomeRowFixture({outcome: 'invalid', count: 3}),
      OutcomeRowFixture({outcome: 'rate_limited', count: 10}),
      OutcomeRowFixture({outcome: 'invalid', count: 4, reason: 'timestamp'}),
    ]);

    expect(buckets[0]!.byOutcome).toEqual([
      expect.objectContaining({outcome: 'rate_limited', count: 10}),
      expect.objectContaining({outcome: 'invalid', count: 7}),
    ]);
  });

  it('joins accepted volume by start', () => {
    const buckets = groupIntoBuckets(
      [OutcomeRowFixture({start: 0, end: 60_000, count: 10})],
      [
        OutcomeRowFixture({start: 0, end: 60_000, count: 90, outcome: 'accepted'}),
        OutcomeRowFixture({
          start: 60_000,
          end: 120_000,
          count: 500,
          outcome: 'accepted',
        }),
      ]
    );

    expect(buckets[0]!.accepted).toBe(90);
    expect(buckets[0]!.ratio).toBe(0.1);
  });

  it('treats a missing accepted event as zero accepted volume', () => {
    const buckets = groupIntoBuckets([
      OutcomeRowFixture({start: 0, end: 60_000, count: 10}),
    ]);

    expect(buckets[0]!.accepted).toBe(0);
    expect(buckets[0]!.ratio).toBe(1);
  });

  it('keeps time ranges without unintentional drops as zero-ratio buckets', () => {
    const buckets = groupIntoBuckets(
      [
        OutcomeRowFixture({start: 0, end: 60_000, count: 10}),
        OutcomeRowFixture({
          start: 120_000,
          end: 180_000,
          tags: ['intentional'],
        }),
      ],
      [
        OutcomeRowFixture({start: 0, end: 60_000, count: 90, outcome: 'accepted'}),
        OutcomeRowFixture({
          start: 60_000,
          end: 120_000,
          count: 30,
          outcome: 'accepted',
        }),
        OutcomeRowFixture({
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
        accepted: 50,
        dropped: 0,
        byOutcome: [],
      }),
      expect.objectContaining({start: 120_000, end: 180_000, ratio: 0}),
    ]);
  });
});
