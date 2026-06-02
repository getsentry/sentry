import {TraceTimeCompression} from './traceTimeCompression';

function node(type: string, space: [number, number]) {
  return {type, space} as any;
}

describe('TraceTimeCompression', () => {
  it('collapses gaps larger than 10% of the trace duration', () => {
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
    expect(compression.gaps[0]).toMatchObject({start: 100, end: 500});
    expect(compression.gaps[1]).toMatchObject({start: 600, end: 1000});
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
