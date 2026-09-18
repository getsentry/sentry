import type {
  InvestigationDetail,
  InvestigationExecutionDetail,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';

import recordedRunDocument from './recordedRun.json';

/**
 * One response the server actually sent, and how long after the investigation
 * was created it arrived.
 */
export type RecordedFrame<T> = {
  body: T;
  offsetMs: number;
};

export type RecordedInvestigationRun = {
  /** Every distinct `GET /investigations/<id>/` response, in order. */
  detail: Array<RecordedFrame<InvestigationDetail>>;
  /** Offset of the last frame in any stream — the length of the replay. */
  durationMs: number;
  /** Keyed by `<blockId>:<executionId>`, matching the fixture execution key. */
  executions: Record<string, Array<RecordedFrame<InvestigationExecutionDetail>>>;
  investigationId: string;
  /** Every distinct orchestration projection, in order. */
  orchestration: Array<RecordedFrame<InvestigationOrchestration>>;
  recordedAt: string;
};

/**
 * A reference into the recording's string table, standing in for a string the
 * capture repeated. Blocks carry their markdown three times over (`content`,
 * `generatedContent` and `output.markdown`) in every frame, so interning the
 * long strings roughly halves the committed file.
 */
type InternedString = {$s: number};

function isInternedString(node: unknown): node is InternedString {
  return typeof node === 'object' && node !== null && '$s' in node;
}

function expand(node: unknown, strings: string[]): unknown {
  if (Array.isArray(node)) {
    return node.map(item => expand(item, strings));
  }
  if (isInternedString(node)) {
    const value = strings[node.$s];
    if (value === undefined) {
      throw new Error(`Recorded run references missing string ${node.$s}`);
    }
    return value;
  }
  if (typeof node === 'object' && node !== null) {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, expand(value, strings)])
    );
  }
  return node;
}

function loadRecordedRun(): RecordedInvestigationRun {
  const {strings, ...document} = recordedRunDocument;
  const {detail, durationMs, executions, investigationId, orchestration, recordedAt} =
    expand(document, strings) as RecordedInvestigationRun;

  return {detail, durationMs, executions, investigationId, orchestration, recordedAt};
}

/**
 * A real agentic investigation, captured from sentry.io as a HAR and replayed
 * frame by frame. Production identifiers were replaced with synthetic ones
 * when the recording was generated; nothing in it addresses a real object.
 */
export const recordedInvestigationRun: RecordedInvestigationRun = loadRecordedRun();

/**
 * The frame the server would have been serving at `timeMs`, or `undefined`
 * before the first response arrived — which is a loading state, exactly as it
 * was for the viewer at the time.
 */
export function recordedFrameAt<T>(
  frames: Array<RecordedFrame<T>>,
  timeMs: number
): T | undefined {
  let match: T | undefined;
  for (const frame of frames) {
    if (frame.offsetMs > timeMs) {
      break;
    }
    match = frame.body;
  }
  return match;
}

/** Index of the frame {@link recordedFrameAt} would return, or -1. */
export function recordedFrameIndexAt(
  frames: Array<RecordedFrame<unknown>>,
  timeMs: number
): number {
  let index = -1;
  for (const [position, frame] of frames.entries()) {
    if (frame.offsetMs > timeMs) {
      break;
    }
    index = position;
  }
  return index;
}

export type RecordedPhaseMarker = {
  offsetMs: number;
  phase: string;
};

/**
 * Where the run changed phase, for the playback bar's tick marks and seek
 * shortcuts. Derived rather than recorded so it cannot drift from the frames.
 */
export function recordedPhaseMarkers(
  run: RecordedInvestigationRun
): RecordedPhaseMarker[] {
  const markers: RecordedPhaseMarker[] = [];
  for (const frame of run.orchestration) {
    if (markers.at(-1)?.phase === frame.body.phase) {
      continue;
    }
    markers.push({offsetMs: frame.offsetMs, phase: frame.body.phase});
  }
  return markers;
}
