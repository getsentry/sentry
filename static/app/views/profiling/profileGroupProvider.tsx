import {createContext, useContext, useMemo} from 'react';

import {importProfile, ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';

type ProfileGroupContextValue = ProfileGroup;

const ProfileGroupContext = createContext<ProfileGroupContextValue | null>(null);

export function useProfileGroup() {
  const context = useContext(ProfileGroupContext);
  if (!context) {
    throw new Error('useProfileGroup was called outside of ProfileGroupProvider');
  }
  return context;
}

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
  const profileGroup = useMemo(() => {
    if (!props.input) {
      return LoadingGroup;
    }
    return importProfile(props.input, props.traceID, props.type);
  }, [props.input, props.traceID, props.type]);

  return (
    <ProfileGroupContext.Provider value={profileGroup}>
      {props.children}
    </ProfileGroupContext.Provider>
  );
}
