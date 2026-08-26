import type * as baseNode from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {TraceTimeCompression} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceTimeCompression';
import {
  computeVitalTimestampZoom,
  type VitalZoomSession,
} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceVitalZoom';

function compute(
  overrides: Partial<Parameters<typeof computeVitalTimestampZoom>[0]> = {}
) {
  return computeVitalTimestampZoom({
    compression: TraceTimeCompression.Disabled([0, 1000]),
    minWidth: 1,
    origin: 0,
    session: null,
    timestamp: 425,
    traceWidth: 1000,
    viewWidth: 1000,
    vital: 'lcp',
    ...overrides,
  });
}

function markerRatio(timestamp: number, space: [number, number]) {
  return (timestamp - space[0]) / space[1];
}

describe('computeVitalTimestampZoom', () => {
  it('zooms from the full trace on the first click, not the current viewport', () => {
    const result = compute({viewWidth: 200});

    expect(result.shouldResetToFullTrace).toBe(false);
    expect(result.space).toEqual([212.5, 500]);
    expect(result.session).toEqual({
      anchor: 0.425,
      targetWidth: 500,
      vital: 'lcp',
    });
  });

  it('keeps the marker at a stable position across repeated zooms', () => {
    const origin = 10_000;
    const compression = TraceTimeCompression.Disabled([origin, 1000]);
    let session: VitalZoomSession | null = null;

    for (const timestamp of [origin + 100, origin + 900]) {
      session = null;
      for (let i = 0; i < 2; i++) {
        const result = compute({
          compression,
          origin,
          session,
          timestamp,
          viewWidth: 1000,
        });
        session = result.session;
        expect(markerRatio(timestamp, result.space)).toBeCloseTo(
          (timestamp - origin) / 1000
        );
      }
    }
  });

  it('zooms from the planned target when repeated before the view has landed', () => {
    const first = compute();
    const second = compute({
      session: first.session,
      viewWidth: 1000,
    });

    expect(second.shouldResetToFullTrace).toBe(false);
    expect(second.space).toEqual([318.75, 250]);
  });

  it('zooms from the current viewport when it is already tighter than the planned target', () => {
    const first = compute();
    const second = compute({
      session: first.session,
      viewWidth: 200,
    });

    expect(second.space[1]).toBe(100);
  });

  it('resets to the full trace before zooming to a different vital', () => {
    const first = compute();
    const second = compute({
      session: first.session,
      timestamp: 750,
      vital: 'fcp',
    });

    expect(second.shouldResetToFullTrace).toBe(true);
    expect(second.session.vital).toBe('fcp');
    expect(second.space).toEqual([375, 500]);
  });

  it('does not zoom narrower than minWidth', () => {
    const result = compute({minWidth: 800});

    expect(result.space[1]).toBe(800);
  });

  it('clamps the window to the trace bounds', () => {
    const result = compute({timestamp: 0});

    expect(result.space[0]).toBe(0);
    expect(result.space[1]).toBe(500);
  });

  it('preserves the marker position in compressed space', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      indicators: [],
      nodes: [
        {space: [0, 100], type: 'transaction'} as unknown as baseNode.BaseNode,
        {space: [500, 100], type: 'span'} as unknown as baseNode.BaseNode,
      ],
      physicalWidth: 1000,
      traceSpace: [0, 1000],
    });
    expect(compression.enabled).toBe(true);

    const timestamp = 550;
    const result = compute({compression, timestamp});
    const visualTimestamp = compression.toCompressedOffset(timestamp);
    const visualStart = compression.toCompressedOffset(result.space[0]);
    const visualEnd = compression.toCompressedOffset(result.space[0] + result.space[1]);

    expect((visualTimestamp - visualStart) / (visualEnd - visualStart)).toBeCloseTo(
      result.session.anchor
    );
  });
});
