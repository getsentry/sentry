import type {HydratedReplayRecord} from 'sentry/views/explore/replays/types';

import type {RecordingFrame} from './types';
import {EventType} from './types';

export function recordingEndFrame(replayRecord: HydratedReplayRecord): RecordingFrame {
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
