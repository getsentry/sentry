import type {RecordingFrame} from 'sentry/utils/replays/types';
import {EventType} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

export function recordingEndFrame(replayRecord: ReplayRecord): RecordingFrame {
  return {
    type: EventType.Custom,
    timestamp: replayRecord.finished_at.getTime(),
    data: {
      tag: 'replay.end',
      payload: {},
    },
  };
}

export function clipEndFrame(timestamp: number): RecordingFrame {
  return {
    type: EventType.Custom,
    timestamp,
    data: {
      tag: 'replay.clip_end',
      payload: {},
    },
  };
}
