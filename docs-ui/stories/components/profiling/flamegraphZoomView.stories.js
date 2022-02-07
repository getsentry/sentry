import {FlamegraphZoomView} from 'sentry/components/profiling/FlamegraphZoomView';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {LightFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

const trace = require('./EventedTrace.json');

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

export const EventedTrace = ({inverted, leftHeavy}) => {
  const canvasPoolManager = new CanvasPoolManager();

  const profiles = importProfile(trace);
  const flamegraph = new Flamegraph(profiles.profiles[0], 0, inverted, leftHeavy);

  return (
    <FlamegraphZoomView
      flamegraph={flamegraph}
      highlightRecursion="false"
      colorCoding="by symbol name"
      canvasPoolManager={canvasPoolManager}
      flamegraphTheme={LightFlamegraphTheme}
    />
  );
};

EventedTrace.args = {
  inverted: false,
  leftHeavy: false,
};
