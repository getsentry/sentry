import * as React from 'react';

import {FlamegraphZoomView} from 'sentry/components/profiling/FlamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/profiling/FlamegraphZoomViewMinimap';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {LightFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

const trace = require('./EventedTrace.json');

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

export const EventedTrace = () => {
  const canvasPoolManager = new CanvasPoolManager();

  const profiles = importProfile(trace);
  const flamegraph = new Flamegraph(profiles.profiles[0]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: `100vh`,
        overflow: 'hidden',
        overscrollBehavior: 'contain',
      }}
    >
      <div style={{height: 100, position: 'relative'}}>
        <FlamegraphZoomViewMinimap
          flamegraph={flamegraph}
          highlightRecursion={false}
          colorCoding="by symbol name"
          canvasPoolManager={canvasPoolManager}
          flamegraphTheme={LightFlamegraphTheme}
        />
      </div>
      <div style={{position: 'relative', flex: '1 1 0%'}}>
        <FlamegraphZoomView
          flamegraph={flamegraph}
          highlightRecursion={false}
          colorCoding="by symbol name"
          canvasPoolManager={canvasPoolManager}
          flamegraphTheme={LightFlamegraphTheme}
        />
      </div>
    </div>
  );
};
