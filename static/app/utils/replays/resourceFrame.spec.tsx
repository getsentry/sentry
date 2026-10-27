import {
  ReplayRequestFrameFixture,
  ReplayResourceFrameFixture,
} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {hydrateSpans} from 'sentry/utils/replays/hydrateSpans';
import {
  getFrameMethod,
  getFrameStatus,
  getReqRespContentTypes,
  getResponseBodySize,
} from 'sentry/utils/replays/resourceFrame';

describe('resourceFrame', () => {
  const startTimestamp = new Date(1663131080.64);
  const endTimestamp = new Date(1663131080.65);

  it.each([
    ReplayResourceFrameFixture({op: 'resource.script', startTimestamp, endTimestamp}),
    ReplayRequestFrameFixture({op: 'resource.fetch', startTimestamp, endTimestamp}),
  ])('should handle a $op frame without data', rawFrame => {
    const [frame] = hydrateSpans(ReplayRecordFixture(), [
      {...rawFrame, data: undefined} as any,
    ]);

    expect(getFrameMethod(frame!)).toBe('GET');
    expect(getFrameStatus(frame!)).toBeUndefined();
    expect(getReqRespContentTypes(frame!)).toEqual({req: undefined, resp: undefined});
    expect(getResponseBodySize(frame!)).toBeUndefined();
  });
});
