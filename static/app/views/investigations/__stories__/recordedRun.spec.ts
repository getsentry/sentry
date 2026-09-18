import {
  recordedFrameAt,
  recordedFrameIndexAt,
  recordedInvestigationRun,
  recordedPhaseMarkers,
} from 'sentry/views/investigations/__stories__/recordedRun';

describe('recordedInvestigationRun', () => {
  it('rehydrates every interned string', () => {
    const serialized = JSON.stringify(recordedInvestigationRun);

    expect(serialized).not.toContain('"$s"');
  });

  it('reaches a completed run with a composed report', () => {
    const lastOrchestration = recordedInvestigationRun.orchestration.at(-1)?.body;
    const lastDetail = recordedInvestigationRun.detail.at(-1)?.body;

    expect(lastOrchestration?.phase).toBe('completed');
    expect(lastOrchestration?.status).toBe('completed');
    expect(lastOrchestration?.hypotheses.length).toBeGreaterThan(0);
    expect(lastDetail?.blocks?.length).toBeGreaterThan(0);
  });

  it('orders frames and ends at the recorded duration', () => {
    const offsets = recordedInvestigationRun.orchestration.map(frame => frame.offsetMs);

    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(Math.max(...offsets)).toBe(recordedInvestigationRun.durationMs);
  });

  it('serves nothing before the first response and the last frame at the end', () => {
    const {orchestration, durationMs} = recordedInvestigationRun;
    const firstOffset = orchestration[0]!.offsetMs;

    expect(recordedFrameAt(orchestration, firstOffset - 1)).toBeUndefined();
    expect(recordedFrameIndexAt(orchestration, firstOffset - 1)).toBe(-1);
    expect(recordedFrameAt(orchestration, firstOffset)).toBe(orchestration[0]!.body);
    expect(recordedFrameAt(orchestration, durationMs)).toBe(orchestration.at(-1)!.body);
  });

  it('marks each phase transition once, in order', () => {
    const markers = recordedPhaseMarkers(recordedInvestigationRun);
    const phases = markers.map(marker => marker.phase);

    expect(phases).toEqual([...new Set(phases)]);
    expect(phases).toContain('broad_scan');
    expect(phases.at(-1)).toBe('completed');
    expect(markers.map(marker => marker.offsetMs)).toEqual(
      Array.from(markers, marker => marker.offsetMs).sort((a, b) => a - b)
    );
  });
});
