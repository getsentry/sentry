import * as BreadcrumbFrameData from './replay/replayBreadcrumbFrameData';
import * as ReplayFrameEvents from './replay/replayFrameEvents';
import * as ReplaySpanFrameData from './replay/replaySpanFrameData';

const Stubs = {
  ...ReplayFrameEvents,
  ...BreadcrumbFrameData,
  ...ReplaySpanFrameData,
};

export default Stubs;
