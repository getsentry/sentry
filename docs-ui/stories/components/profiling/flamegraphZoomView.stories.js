import styled from '@emotion/styled';

import {Flamegraph} from 'sentry/components/profiling/flamegraph/flamegraph';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';
import {OrganizationContext} from 'sentry/views/organizationContext';
import ProfileGroupProvider from 'sentry/views/profiling/profileGroupProvider';
import {RouteContext} from 'sentry/views/routeContext';

const FlamegraphContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100vh;
`;

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

const emptyRouteContext = {
  location: {
    pathname: '',
  },
  params: {},
};

function FlamegraphStory({profiles}) {
  return (
    <RouteContext.Provider value={emptyRouteContext}>
      <OrganizationContext.Provider value={{}}>
        <ProfileGroupProvider>
          <FlamegraphStateProvider
            initialState={{
              profiles: {
                threadId: profiles.profiles[0].threadId,
              },
            }}
          >
            <FlamegraphThemeProvider>
              <FlamegraphContainer>
                {profiles && <Flamegraph profiles={profiles} />}
              </FlamegraphContainer>
            </FlamegraphThemeProvider>
          </FlamegraphStateProvider>
        </ProfileGroupProvider>
      </OrganizationContext.Provider>
    </RouteContext.Provider>
  );
}

const eventedProfiles = importProfile(
  require('sentry/utils/profiling/profile/formats/android/trace.json')
);

export const EventedTrace = () => {
  return <FlamegraphStory profiles={eventedProfiles} />;
};

const sampledTrace = importProfile(
  require('sentry/utils/profiling/profile/formats/ios/trace.json')
);

export const SampledTrace = () => {
  return <FlamegraphStory profiles={sampledTrace} />;
};

const jsSelfProfile = importProfile(
  require('sentry/utils/profiling/profile/formats/jsSelfProfile/trace.json')
);

export const JSSelfProfiling = () => {
  return <FlamegraphStory profiles={jsSelfProfile} />;
};

const typescriptProfile = importProfile(
  require('sentry/utils/profiling/profile/formats/typescript/trace.json')
);

export const TypescriptProfile = () => {
  return <FlamegraphStory profiles={typescriptProfile} />;
};
