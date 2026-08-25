import {COLLAPSED_GAP_WIDTH_PX, TraceTimeCompression} from './traceTimeCompression';

function node(type: string, space: [number, number]) {
  return {type, space} as any;
}

describe('TraceTimeCompression', () => {
  it('collapses gaps at least twice the collapsed marker width', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      viewSpace: [0, 1000],
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
    expect(compression.gaps[0]).toMatchObject({start: 148, end: 452});
    expect(compression.gaps[1]).toMatchObject({start: 648, end: 1000});
  });

  it('keeps a pixel-derived duration label buffer around visible spans', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 10_000],
      viewSpace: [0, 10_000],
      physicalWidth: 1000,
      nodes: [node('span', [2000, 1000]), node('span', [7000, 1000])],
      indicators: [],
    });

    // 48px in a 10s trace rendered into 1000px is 480ms of real timeline buffer.
    expect(compression.gaps).toHaveLength(3);
    expect(compression.gaps[0]).toMatchObject({start: 0, end: 1520});
    expect(compression.gaps[1]).toMatchObject({start: 3480, end: 6520});
    expect(compression.gaps[2]).toMatchObject({start: 8480, end: 10_000});
  });

  it('does not collapse gaps covered by visible intervals', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      viewSpace: [0, 1000],
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

  it('keeps a pixel-derived buffer around zero-duration errors', () => {
    const physicalWidth = 600;
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 3_600_000],
      viewSpace: [0, 3_600_000],
      physicalWidth,
      nodes: [
        node('span', [0, 600_000]),
        node('error', [2_100_000, 0]),
        node('span', [3_000_000, 600_000]),
      ],
      indicators: [],
    });

    expect(compression.gaps).toHaveLength(2);
    const [beforeError, afterError] = compression.gaps;
    const errorBufferPx =
      ((afterError!.compressedStart - beforeError!.compressedEnd) /
        compression.compressedDuration) *
      physicalWidth;

    expect(errorBufferPx).toBeGreaterThanOrEqual(COLLAPSED_GAP_WIDTH_PX * 2);
  });

  it('round trips between real and compressed coordinates', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      viewSpace: [0, 1000],
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
      viewSpace: [0, 1000],
      physicalWidth: 1000,
      nodes: [node('transaction', [0, 100]), node('span', [500, 100])],
      indicators: [],
    });

    expect(compression.enabled).toBe(false);
    expect(compression.toCompressedOffset(500)).toBe(500);
  });

  it('uses the uncompressed viewport to qualify gaps at 56px', () => {
    const options = {
      enabled: true,
      traceSpace: [0, 1000] as [number, number],
      viewSpace: [0, 1000] as [number, number],
      nodes: [node('span', [0, 100]), node('span', [500, 500])],
      indicators: [],
    };

    expect(
      TraceTimeCompression.FromVisibleItems({...options, physicalWidth: 379}).enabled
    ).toBe(false);
    expect(
      TraceTimeCompression.FromVisibleItems({...options, physicalWidth: 380}).enabled
    ).toBe(true);
  });

  it('discovers gaps that become wide enough in a zoomed viewport', () => {
    const options = {
      enabled: true,
      traceSpace: [0, 1000] as [number, number],
      physicalWidth: 1000,
      nodes: [node('span', [0, 100]), node('span', [160, 840])],
      indicators: [],
    };

    expect(
      TraceTimeCompression.FromVisibleItems({
        ...options,
        viewSpace: [0, 1000],
      }).enabled
    ).toBe(false);
    expect(
      TraceTimeCompression.FromVisibleItems({
        ...options,
        viewSpace: [100, 100],
      }).enabled
    ).toBe(true);
  });

  it('does not collapse empty viewport edges when zoomed into spans', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      viewSpace: [200, 600],
      physicalWidth: 1000,
      nodes: [node('span', [300, 300])],
      indicators: [],
    });

    expect(compression.enabled).toBe(false);
    expect(compression.gaps).toHaveLength(0);
  });

  it('renders fully visible gaps at the collapsed marker width', () => {
    const physicalWidth = 1000;
    const viewSpace: [number, number] = [0, 1000];
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      viewSpace,
      physicalWidth,
      nodes: [node('span', [0, 100]), node('span', [500, 100])],
      indicators: [],
    });
    const compressedViewDuration =
      compression.toCompressedOffset(viewSpace[0] + viewSpace[1]) -
      compression.toCompressedOffset(viewSpace[0]);

    for (const gap of compression.gaps) {
      expect((gap.retainedDuration / compressedViewDuration) * physicalWidth).toBeCloseTo(
        COLLAPSED_GAP_WIDTH_PX
      );
    }
  });

  it('does not collapse a gap crossing a zoomed viewport edge', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      viewSpace: [300, 300],
      physicalWidth: 1000,
      nodes: [node('span', [0, 100]), node('span', [500, 500])],
      indicators: [],
    });

    expect(compression.enabled).toBe(false);
    expect(compression.gaps).toHaveLength(0);
  });

  it('disables compression when the viewport contains only inactive time', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      viewSpace: [400, 100],
      physicalWidth: 1000,
      nodes: [node('span', [0, 100]), node('span', [900, 100])],
      indicators: [],
    });

    expect(compression.enabled).toBe(false);
  });
});
