import {Flamegraph} from 'sentry/components/profiling/Flamegraph';
import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/FullScreenFlamegraphContainer';
import {FlamegraphPreferencesProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphPreferencesProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphThemeProvider';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';
import {JSSelfProfile} from 'sentry/utils/profiling/profile/jsSelfProfile.tsx';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

const eventedProfiles = importProfile(require('./EventedTrace.json'));

export const EventedTrace = () => {
  return (
    <FlamegraphPreferencesProvider>
      <FlamegraphThemeProvider>
        <FullScreenFlamegraphContainer>
          <Flamegraph profiles={eventedProfiles} />
        </FullScreenFlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphPreferencesProvider>
  );
};

const jsSelfProfile = require('./JSSelfProfilingTrace.json');

export const JSSelfProfiling = () => {
  const profiles = {
    name: 'JS Self Profiling',
    activeProfileIndex: 0,
    traceID: '',
    profiles: [
      JSSelfProfile.FromProfile(
        jsSelfProfile,
        createFrameIndex(jsSelfProfile.frames, jsSelfProfile)
      ),
    ],
  };

  return (
    <FlamegraphPreferencesProvider>
      <FlamegraphThemeProvider>
        <FullScreenFlamegraphContainer>
          {profiles ? <Flamegraph profiles={profiles} /> : null}
        </FullScreenFlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphPreferencesProvider>
  );
};
