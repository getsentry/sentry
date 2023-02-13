import {createContext, useContext} from 'react';

import {importProfile, ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {memoizeVariadicByReference} from 'sentry/utils/profiling/profile/utils';

type ProfileGroupContextValue = ProfileGroup;

const ProfileGroupContext = createContext<ProfileGroupContextValue | null>(null);

export function useProfileGroup() {
  const context = useContext(ProfileGroupContext);
  if (!context) {
    throw new Error('useProfileGroup was called outside of ProfileGroupProvider');
  }
  return context;
}

// We memoize the importProfile function by argument references, this is because
// relying on a useEffect based on prop types runs too late in the lifecycle and
// causes a temporary missmatch between props.type and importedProfile.type.
const memoizedImport = memoizeVariadicByReference(importProfile);

const LoadingGroup: ProfileGroup = {
  name: 'Loading',
  activeProfileIndex: 0,
  transactionID: null,
  metadata: {},
  measurements: {},
  traceID: '',
  profiles: [],
};

interface ProfileGroupProviderProps {
  children: React.ReactNode;
  input: Readonly<Profiling.ProfileInput> | null;
  traceID: string;
  type: 'flamegraph' | 'flamechart';
}

export function ProfileGroupProvider(props: ProfileGroupProviderProps) {
  return (
    <ProfileGroupContext.Provider
      value={
        props.input
          ? memoizedImport(props.input, props.traceID, props.type)
          : LoadingGroup
      }
    >
      {props.children}
    </ProfileGroupContext.Provider>
  );
}
