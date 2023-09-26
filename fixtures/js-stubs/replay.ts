import * as Error from 'sentry-fixture/replay/error';
import * as Helpers from 'sentry-fixture/replay/helpers';
import * as BreadcrumbFrameData from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import * as ReplayFrameEvents from 'sentry-fixture/replay/replayFrameEvents';
import * as ReplaySpanFrameData from 'sentry-fixture/replay/replaySpanFrameData';
import * as RRweb from 'sentry-fixture/replay/rrweb';

export const Replay = {
  ...BreadcrumbFrameData,
  ...Error,
  ...Helpers,
  ...ReplayFrameEvents,
  ...ReplaySpanFrameData,
  ...RRweb,
};
