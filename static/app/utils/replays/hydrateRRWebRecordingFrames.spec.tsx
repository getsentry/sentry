import {
  recordingEndFrame,
  recordingStartFrame,
} from 'sentry/utils/replays/hydrateRRWebRecordingFrames';
import {RecordingFrame} from 'sentry/utils/replays/types';

describe('hydrateRRWebRecordingFrames', () => {
  const replayRecord = TestStubs.ReplayRecord();

  describe('recordingStartFrame', () => {
    it('should return a RecordingFrame', () => {
      const frame: RecordingFrame = recordingStartFrame(replayRecord);
      expect(frame).toStrictEqual({
        type: 5,
        timestamp: replayRecord.started_at.getTime(),
        data: {
          tag: 'replay.start',
          payload: {},
        },
      });
    });
  });

  describe('recordingEndFrame', () => {
    it('should return a RecordingFrame', () => {
      const frame: RecordingFrame = recordingEndFrame(replayRecord);
      expect(frame).toStrictEqual({
        type: 5,
        timestamp: replayRecord.finished_at.getTime(),
        data: {
          tag: 'replay.end',
          payload: {},
        },
      });
    });
  });
});
