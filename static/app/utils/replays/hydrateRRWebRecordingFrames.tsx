import type {RecordingFrame} from 'sentry/utils/replays/types';
import {EventType} from 'sentry/utils/replays/types';
import {ReplayRecord} from 'sentry/views/replays/types';

export function recordingStartFrame(replayRecord: ReplayRecord): RecordingFrame {
  return {
    type: EventType.Custom,
    timestamp: replayRecord.started_at.getTime(),
    data: {
      tag: 'replay.start',
      payload: {},
    },
  };
}

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
