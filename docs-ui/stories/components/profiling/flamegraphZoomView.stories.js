import {Flamegraph} from 'sentry/components/profiling/flamegraph';
import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/fullScreenFlamegraphContainer';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

const eventedProfiles = importProfile(require('./EventedTrace.json'));

export const EventedTrace = () => {
  return (
    <FlamegraphStateProvider>
      <FlamegraphThemeProvider>
        <FullScreenFlamegraphContainer>
          <Flamegraph profiles={eventedProfiles} />
        </FullScreenFlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphStateProvider>
  );
};

const jsSelfProfile = importProfile(require('./JSSelfProfilingTrace.json'));

export const JSSelfProfiling = () => {
  return (
    <FlamegraphStateProvider>
      <FlamegraphThemeProvider>
        <FullScreenFlamegraphContainer>
          {jsSelfProfile ? <Flamegraph profiles={jsSelfProfile} /> : null}
        </FullScreenFlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphStateProvider>
  );
};
