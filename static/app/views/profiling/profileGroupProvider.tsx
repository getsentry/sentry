import {createContext, useContext, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import type {Frame} from 'sentry/utils/profiling/frame';
import type {
  ContinuousProfileGroup,
  ProfileGroup,
} from 'sentry/utils/profiling/profile/importProfile';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

type ProfileGroupContextValue = ContinuousProfileGroup | ProfileGroup;
const ProfileGroupContext = createContext<ProfileGroupContextValue | null>(null);

function assertContinuousProfileGroup(
  input: ProfileGroupContextValue | null
): asserts input is ContinuousProfileGroup {
  if (input && input.type !== 'loading' && input.type !== 'continuous') {
    throw new Error('ProfileGroup is not of continuous profile type.');
  }
}

function assertTransactionProfileGroup(
  input: ProfileGroupContextValue | null
): asserts input is ProfileGroup {
  if (input && input.type !== 'loading' && input.type !== 'transaction') {
    throw new Error('ProfileGroup is not of transaction profile type.');
  }
}

export function useProfileGroup(): ProfileGroup {
  const context = useContext(ProfileGroupContext);
  if (!context) {
    throw new Error('useProfileGroup was called outside of ProfileGroupProvider');
  }
  assertTransactionProfileGroup(context);
  return context;
}

export function useContinuousProfileGroup(): ContinuousProfileGroup {
  const context = useContext(ProfileGroupContext);
  if (!context) {
    throw new Error(
      'useContinuousProfileGroup was called outside of ProfileGroupProvider'
    );
  }
  assertContinuousProfileGroup(context);
  return context;
}

export const LOADING_PROFILE_GROUP: Readonly<ProfileGroup> = {
  name: 'Loading',
  activeProfileIndex: 0,
  transactionID: null,
  metadata: {},
  measurements: {},
  traceID: '',
  profiles: [],
  type: 'loading',
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
      return LOADING_PROFILE_GROUP;
    }
    const qs = new URLSearchParams(window.location.search);
    const threadId = qs.get('tid');

    try {
      return importProfile(
        props.input,
        props.traceID,
        threadId,
        props.type,
        props.frameFilter
      );
    } catch (err) {
      Sentry.captureException(err);
      return LOADING_PROFILE_GROUP;
    }
  }, [props.input, props.traceID, props.type, props.frameFilter]);

  return (
    <ProfileGroupContext.Provider value={profileGroup}>
      {props.children}
    </ProfileGroupContext.Provider>
  );
}
