import styled from '@emotion/styled';

import {Flamegraph} from 'sentry/components/profiling/flamegraph';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

const FlamegraphContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100vh;
`;

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

const eventedProfiles = importProfile(
  require('sentry/utils/profiling/profile/formats/android/trace.json')
);

export const EventedTrace = () => {
  return (
    <FlamegraphStateProvider>
      <FlamegraphThemeProvider>
        <FlamegraphContainer>
          <Flamegraph profiles={eventedProfiles} />
        </FlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphStateProvider>
  );
};

const sampledTrace = importProfile(
  require('sentry/utils/profiling/profile/formats/ios/trace.json')
);

export const SampledTrace = () => {
  return (
    <FlamegraphStateProvider>
      <FlamegraphThemeProvider>
        <FlamegraphContainer>
          <Flamegraph profiles={sampledTrace} />
        </FlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphStateProvider>
  );
};

const jsSelfProfile = importProfile(
  require('sentry/utils/profiling/profile/formats/jsSelfProfile/trace.json')
);

export const JSSelfProfiling = () => {
  return (
    <FlamegraphStateProvider>
      <FlamegraphThemeProvider>
        <FlamegraphContainer>
          {jsSelfProfile ? <Flamegraph profiles={jsSelfProfile} /> : null}
        </FlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphStateProvider>
  );
};

const typescriptProfile = importProfile(
  require('sentry/utils/profiling/profile/formats/typescript/trace.json')
);

export const TypescriptProfile = () => {
  return (
    <FlamegraphStateProvider>
      <FlamegraphThemeProvider>
        <FlamegraphContainer>
          {typescriptProfile ? <Flamegraph profiles={typescriptProfile} /> : null}
        </FlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphStateProvider>
  );
};
