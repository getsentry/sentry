import {computeTimeChunks} from 'sentry/utils/chunkedTimeRange/computeTimeChunks';

const HOUR = 60 * 60 * 1000;

describe('computeTimeChunks', () => {
  it('returns no chunks for invalid inputs', () => {
    expect(computeTimeChunks({start: 100, end: 0, interval: '1h'})).toEqual([]);
    expect(computeTimeChunks({start: 0, end: 0, interval: '1h'})).toEqual([]);
    expect(computeTimeChunks({start: 0, end: 10 * HOUR, interval: 'garbage'})).toEqual(
      []
    );
  });

  it('returns a single epoch-aligned chunk for small ranges', () => {
    // 10 buckets < the chunking threshold.
    expect(computeTimeChunks({start: 0, end: 10 * HOUR, interval: '1h'})).toEqual([
      {start: 0, end: 10 * HOUR},
    ]);
  });

  it('does not chunk right below the threshold', () => {
    expect(computeTimeChunks({start: 0, end: 59 * HOUR, interval: '1h'})).toHaveLength(1);
  });

  it('splits wide ranges into uneven, newest-first, growing chunks', () => {
    // 720 buckets (30d @ 1h).
    const chunks = computeTimeChunks({start: 0, end: 720 * HOUR, interval: '1h'});

    // Sizes grow older-ward: 15, 45, 135, 405, then the remainder (120).
    expect(chunks.map(c => Math.round((c.end - c.start) / HOUR))).toEqual([
      15, 45, 135, 405, 120,
    ]);

    expect(chunks[0]!.end).toBe(720 * HOUR);
    expect(chunks.at(-1)!.start).toBe(0);
  });

  it('produces contiguous, non-overlapping, epoch-aligned chunks covering the range', () => {
    const chunks = computeTimeChunks({start: 0, end: 720 * HOUR, interval: '1h'});

    for (const chunk of chunks) {
      expect(chunk.start % HOUR).toBe(0);
      expect(chunk.end % HOUR).toBe(0);
    }
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.end).toBe(chunks[i - 1]!.start);
    }
  });

  it('snaps unaligned outer bounds to the epoch grid', () => {
    const chunks = computeTimeChunks({
      start: 30 * 60 * 1000,
      end: 100 * HOUR + 15 * 60 * 1000,
      interval: '1h',
    });

    expect(chunks[0]!.end).toBe(101 * HOUR); // ceil
    expect(chunks.at(-1)!.start).toBe(0); // floor
  });

  it('honors a custom chunk policy', () => {
    const chunks = computeTimeChunks({
      start: 0,
      end: 100 * HOUR,
      interval: '1h',
      policy: {initialBuckets: 10, growthFactor: 2, maxChunks: 3, minBucketsToChunk: 20},
    });

    // Newest-first: 10, 20, then the oldest chunk absorbs the remainder (70).
    expect(chunks.map(c => Math.round((c.end - c.start) / HOUR))).toEqual([10, 20, 70]);
  });
});
