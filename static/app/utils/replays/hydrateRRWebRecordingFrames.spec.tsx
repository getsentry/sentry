import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {recordingEndFrame} from 'sentry/utils/replays/hydrateRRWebRecordingFrames';
import type {RecordingFrame} from 'sentry/utils/replays/types';

describe('hydrateRRWebRecordingFrames', () => {
  const replayRecord = ReplayRecordFixture();

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
