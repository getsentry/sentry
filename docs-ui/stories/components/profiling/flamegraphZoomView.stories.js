import {Flamegraph} from 'sentry/components/profiling/Flamegraph';
import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/FullScreenFlamegraphContainer';
import {FlamegraphPreferencesProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphPreferencesProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphThemeProvider';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

const profiles = importProfile(require('./EventedTrace.json'));

export const EventedTrace = () => {
  return (
    <FlamegraphPreferencesProvider>
      <FlamegraphThemeProvider>
        <FullScreenFlamegraphContainer>
          <Flamegraph profiles={profiles} />
        </FullScreenFlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphPreferencesProvider>
  );
};
