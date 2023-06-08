import * as Helpers from './replay/helpers';
import * as BreadcrumbFrameData from './replay/replayBreadcrumbFrameData';
import * as ReplayFrameEvents from './replay/replayFrameEvents';
import * as ReplaySpanFrameData from './replay/replaySpanFrameData';
import * as RRweb from './replay/rrweb';

export const Replay = {
  ...BreadcrumbFrameData,
  ...Helpers,
  ...ReplayFrameEvents,
  ...ReplaySpanFrameData,
  ...RRweb,
};
