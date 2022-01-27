import {FlamegraphZoomView} from 'sentry/components/profiling/FlamegraphZoomView';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {LightFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

export const EventedTrace = () => {
  const canvasPoolManager = new CanvasPoolManager();

  const trace = {
    name: 'profile',
    startValue: 0,
    endValue: 1,
    unit: 'milliseconds',
    type: 'evented',
    events: [
      {type: 'O', at: 0, frame: 0},
      {type: 'O', at: 1, frame: 0},
      {type: 'C', at: 1, frame: 0},
      {type: 'C', at: 1, frame: 0},
      {type: 'O', at: 1, frame: 0},
      {type: 'O', at: 2, frame: 1},
      {type: 'O', at: 3, frame: 2},
      {type: 'C', at: 4, frame: 2},
      {type: 'C', at: 4, frame: 1},
      {type: 'C', at: 5, frame: 0},
    ],
    shared: {
      frames: [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}],
    },
  };

  const flamegraph = new Flamegraph(EventedProfile.FromProfile(trace));

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
