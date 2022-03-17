import {Flamegraph} from 'sentry/components/profiling/flamegraph';
import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/fullScreenFlamegraphContainer';
import {FlamegraphPreferencesProvider} from 'sentry/utils/profiling/flamegraph/flamegraphPreferencesProvider';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

const eventedProfiles = importProfile(require('./EventedTrace.json'));

export const EventedTrace = () => {
  return (
    <FlamegraphPreferencesProvider>
      <FlamegraphThemeProvider>
        <FullScreenFlamegraphContainer>
          <FlamegraphStateProvider>
            <Flamegraph profiles={eventedProfiles} />
          </FlamegraphStateProvider>
        </FullScreenFlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphPreferencesProvider>
  );
};

const jsSelfProfile = importProfile(require('./JSSelfProfilingTrace.json'));

export const JSSelfProfiling = () => {
  return (
    <FlamegraphPreferencesProvider>
      <FlamegraphThemeProvider>
        <FullScreenFlamegraphContainer>
          <FlamegraphStateProvider>
            {jsSelfProfile ? <Flamegraph profiles={jsSelfProfile} /> : null}
          </FlamegraphStateProvider>
        </FullScreenFlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphPreferencesProvider>
  );
};
