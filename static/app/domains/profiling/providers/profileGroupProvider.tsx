import {createContext, useContext, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {
  importProfile,
  ProfileGroup,
} from 'sentry/domains/profiling/utils/profile/importProfile';
import {Frame} from 'sentry/domains/profiling/utils/profiling/frame';

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
  frameFilter?: (frame: Frame) => boolean;
}

export function ProfileGroupProvider(props: ProfileGroupProviderProps) {
  const profileGroup = useMemo(() => {
    if (!props.input) {
      return LoadingGroup;
    }
    try {
      return importProfile(props.input, props.traceID, props.type, props.frameFilter);
    } catch (err) {
      Sentry.captureException(err);
      return LoadingGroup;
    }
  }, [props.input, props.traceID, props.type, props.frameFilter]);

  return (
    <ProfileGroupContext.Provider value={profileGroup}>
      {props.children}
    </ProfileGroupContext.Provider>
  );
}
