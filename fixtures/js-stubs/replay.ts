import * as ReplayFrameEvents from 'sentry-fixture/replay/replayFrameEvents';
import * as ReplaySpanFrameData from 'sentry-fixture/replay/replaySpanFrameData';
import * as RRweb from 'sentry-fixture/replay/rrweb';

export const Replay = {
  ...ReplayFrameEvents,
  ...ReplaySpanFrameData,
  ...RRweb,
};
