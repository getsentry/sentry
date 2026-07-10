import {computeHeatMapChunks} from 'sentry/views/explore/metrics/hooks/computeHeatMapChunks';

const HOUR = 60 * 60 * 1000;

describe('computeHeatMapChunks', () => {
  it('returns no chunks for invalid inputs', () => {
    expect(computeHeatMapChunks({start: 100, end: 0, interval: '1h'})).toEqual([]);
    expect(computeHeatMapChunks({start: 0, end: 0, interval: '1h'})).toEqual([]);
    expect(computeHeatMapChunks({start: 0, end: 10 * HOUR, interval: 'garbage'})).toEqual(
      []
    );
  });

  it('returns a single epoch-aligned chunk for small ranges', () => {
    // 10 buckets < the chunking threshold.
    expect(computeHeatMapChunks({start: 0, end: 10 * HOUR, interval: '1h'})).toEqual([
      {start: 0, end: 10 * HOUR},
    ]);
  });

  it('does not chunk right below the threshold', () => {
    const chunks = computeHeatMapChunks({start: 0, end: 59 * HOUR, interval: '1h'});
    expect(chunks).toHaveLength(1);
  });

  it('splits wide ranges into uneven, newest-first, growing chunks', () => {
    // 720 buckets (30d @ 1h).
    const chunks = computeHeatMapChunks({start: 0, end: 720 * HOUR, interval: '1h'});

    // Sizes grow older-ward: 15, 45, 135, 405, then the remainder (120).
    expect(chunks.map(c => Math.round((c.end - c.start) / HOUR))).toEqual([
      15, 45, 135, 405, 120,
    ]);

    // Newest chunk is first and smallest, touching the range end.
    expect(chunks[0]!.end).toBe(720 * HOUR);
    // Oldest chunk is last, touching the range start.
    expect(chunks.at(-1)!.start).toBe(0);
  });

  it('produces contiguous, non-overlapping, epoch-aligned chunks covering the range', () => {
    const chunks = computeHeatMapChunks({start: 0, end: 720 * HOUR, interval: '1h'});

    for (const chunk of chunks) {
      expect(chunk.start % HOUR).toBe(0);
      expect(chunk.end % HOUR).toBe(0);
    }

    // Each chunk's start meets the previous (newer) chunk's start end-to-end.
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.end).toBe(chunks[i - 1]!.start);
    }
  });

  it('snaps unaligned outer bounds to the epoch grid', () => {
    // Start 30m past an hour edge, end 15m past — both should snap outward.
    const chunks = computeHeatMapChunks({
      start: 30 * 60 * 1000,
      end: 100 * HOUR + 15 * 60 * 1000,
      interval: '1h',
    });

    expect(chunks[0]!.end).toBe(101 * HOUR); // ceil
    expect(chunks.at(-1)!.start).toBe(0); // floor
    for (const chunk of chunks) {
      expect(chunk.start % HOUR).toBe(0);
      expect(chunk.end % HOUR).toBe(0);
    }
  });
});
