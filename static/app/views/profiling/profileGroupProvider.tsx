import {createContext, useContext, useEffect, useState} from 'react';

import {
  importProfile,
  ProfileGroup,
  ProfileInput,
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
  input: ProfileInput | null;
  traceID: string;
}

export function ProfileGroupProvider(props: ProfileGroupProviderProps) {
  const [profileGroup, setProfileGroup] = useState<ProfileGroup>(LoadingGroup);

  useEffect(() => {
    if (!props.input) {
      return;
    }

    setProfileGroup(importProfile(props.input, props.traceID));
  }, [props.input, props.traceID]);

  return (
    <ProfileGroupContext.Provider value={profileGroup}>
      {props.children}
    </ProfileGroupContext.Provider>
  );
}
