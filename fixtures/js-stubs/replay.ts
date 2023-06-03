import * as BreadcrumbFrameData from './replay/replayBreadcrumbFrameData';
import * as ReplayFrameEvents from './replay/replayFrameEvents';
import * as ReplaySpanFrameData from './replay/replaySpanFrameData';

export const Replay = {
  ...BreadcrumbFrameData,
  ...ReplayFrameEvents,
  ...ReplaySpanFrameData,
};
