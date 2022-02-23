import * as React from 'react';

import {Flamegraph} from 'sentry/components/profiling/Flamegraph';
import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/FullScreenFlamegraphContainer';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphThemeProvider';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

const trace = require('./EventedTrace.json');

const profiles = importProfile(trace);

export const EventedTrace = () => {
  return (
    <FlamegraphThemeProvider>
      <FullScreenFlamegraphContainer>
        <Flamegraph profiles={profiles} />
      </FullScreenFlamegraphContainer>
    </FlamegraphThemeProvider>
  );
};
