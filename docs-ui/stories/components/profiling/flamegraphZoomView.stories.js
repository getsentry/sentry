import {useState} from 'react';
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
  const [profiles, setProfiles] = useState(eventedProfiles);

  return (
    <FlamegraphStateProvider>
      <FlamegraphThemeProvider>
        <FlamegraphContainer>
          <Flamegraph onImport={p => setProfiles(p)} profiles={profiles} />
        </FlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphStateProvider>
  );
};

const sampledTrace = importProfile(
  require('sentry/utils/profiling/profile/formats/ios/trace.json')
);

export const SampledTrace = () => {
  const [profiles, setProfiles] = useState(sampledTrace);

  return (
    <FlamegraphStateProvider>
      <FlamegraphThemeProvider>
        <FlamegraphContainer>
          <Flamegraph onImport={p => setProfiles(p)} profiles={profiles} />
        </FlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphStateProvider>
  );
};

const jsSelfProfile = importProfile(
  require('sentry/utils/profiling/profile/formats/jsSelfProfile/trace.json')
);

export const JSSelfProfiling = () => {
  const [profiles, setProfiles] = useState(jsSelfProfile);

  return (
    <FlamegraphStateProvider>
      <FlamegraphThemeProvider>
        <FlamegraphContainer>
          <Flamegraph onImport={p => setProfiles(p)} profiles={profiles} />
        </FlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphStateProvider>
  );
};

const typescriptProfile = importProfile(
  require('sentry/utils/profiling/profile/formats/typescript/trace.json')
);

export const TypescriptProfile = () => {
  const [profiles, setProfiles] = useState(typescriptProfile);

  return (
    <FlamegraphStateProvider>
      <FlamegraphThemeProvider>
        <FlamegraphContainer>
          <Flamegraph onImport={p => setProfiles(p)} profiles={profiles} />
        </FlamegraphContainer>
      </FlamegraphThemeProvider>
    </FlamegraphStateProvider>
  );
};
