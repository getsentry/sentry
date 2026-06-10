import {TraceTimeCompression} from './traceTimeCompression';

function node(type: string, space: [number, number]) {
  return {type, space} as any;
}

describe('TraceTimeCompression', () => {
  it('collapses gaps at least 5% of the trace duration', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      physicalWidth: 1000,
      nodes: [
        node('trace', [0, 1000]),
        node('transaction', [0, 100]),
        node('span', [500, 100]),
      ],
      indicators: [],
    });

    expect(compression.enabled).toBe(true);
    expect(compression.gaps).toHaveLength(2);
    expect(compression.gaps[0]).toMatchObject({start: 160, end: 440});
    expect(compression.gaps[1]).toMatchObject({start: 660, end: 1000});
  });

  it('keeps a pixel-derived duration label buffer around visible spans', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 10_000],
      physicalWidth: 1000,
      nodes: [node('span', [2000, 1000]), node('span', [7000, 1000])],
      indicators: [],
    });

    // 60px in a 10s trace rendered into 1000px is 600ms of real timeline buffer.
    expect(compression.gaps).toHaveLength(3);
    expect(compression.gaps[0]).toMatchObject({start: 0, end: 1400});
    expect(compression.gaps[1]).toMatchObject({start: 3600, end: 6400});
    expect(compression.gaps[2]).toMatchObject({start: 8600, end: 10_000});
  });

  it('does not collapse gaps covered by visible intervals', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      physicalWidth: 1000,
      nodes: [
        node('transaction', [0, 1000]),
        node('span', [0, 100]),
        node('span', [500, 100]),
      ],
      indicators: [],
    });

    expect(compression.enabled).toBe(false);
    expect(compression.gaps).toHaveLength(0);
  });

  it('keeps marker padding around zero-duration activity', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 10_000],
      physicalWidth: 1000,
      nodes: [node('error', [5000, 0])],
      indicators: [],
    });

    expect(compression.gaps).toHaveLength(2);
    expect(compression.gaps[0]).toMatchObject({start: 0, end: 4900});
    expect(compression.gaps[1]).toMatchObject({start: 5100, end: 10_000});
  });

  it('round trips between real and compressed coordinates', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      physicalWidth: 1000,
      nodes: [node('transaction', [0, 100]), node('span', [500, 100])],
      indicators: [],
    });

    for (const timestamp of [0, 100, 250, 500, 600, 800, 1000]) {
      expect(
        compression.toRealTimestamp(compression.toCompressedOffset(timestamp))
      ).toBeCloseTo(timestamp);
    }
  });

  it('does not collapse when the preference is disabled', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: false,
      traceSpace: [0, 1000],
      physicalWidth: 1000,
      nodes: [node('transaction', [0, 100]), node('span', [500, 100])],
      indicators: [],
    });

    expect(compression.enabled).toBe(false);
    expect(compression.toCompressedOffset(500)).toBe(500);
  });
});
