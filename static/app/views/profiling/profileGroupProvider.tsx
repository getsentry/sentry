import {createContext, useContext, useEffect, useState} from 'react';

import {
  importProfile,
  ProfileGroup,
  sortProfileSamples,
} from 'sentry/utils/profiling/profile/importProfile';

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
  const [profileGroup, setProfileGroup] = useState<ProfileGroup>(LoadingGroup);

  useEffect(() => {
    if (!props.input) {
      return;
    }

    if (props.type === 'flamegraph') {
      const profiles = sortProfileSamples(props.input);
      setProfileGroup(importProfile(profiles, props.traceID, 'flamegraph'));
    } else if (props.type === 'flamechart') {
      setProfileGroup(importProfile(props.input, props.traceID, 'flamechart'));
    } else {
      throw new TypeError(`Unknown view type: ${props.type}`);
    }
  }, [props.input, props.traceID, props.type]);

  return (
    <ProfileGroupContext.Provider value={profileGroup}>
      {props.children}
    </ProfileGroupContext.Provider>
  );
}
