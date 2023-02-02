import {createContext, useContext, useEffect, useState} from 'react';

import {defined} from 'sentry/utils';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphProfiles';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {
  importProfile,
  ProfileGroup,
  ProfileInput,
} from 'sentry/utils/profiling/profile/importProfile';

import {
  useDispatchFlamegraphState,
  useFlamegraphState,
} from '../../utils/profiling/flamegraph/hooks/useFlamegraphState';

type ProfileGroupContextValue = ProfileGroup;

const ProfileGroupContext = createContext<ProfileGroupContextValue | null>(null);

export function useProfileGroup() {
  const context = useContext(ProfileGroupContext);
  if (!context) {
    throw new Error('useProfileGroup was called outside of ProfileGroupProvider');
  }
  return context;
}

type FlamegraphCandidate = {
  frame: FlamegraphFrame;
  threadId: number;
  isActiveThread?: boolean; // this is the thread referred to by the active profile index
};

function findLongestMatchingFrame(
  flamegraph: Flamegraph,
  focusFrame: FlamegraphProfiles['highlightFrames']
): FlamegraphFrame | null {
  if (focusFrame === null) {
    return null;
  }

  let longestFrame: FlamegraphFrame | null = null;

  const frames: FlamegraphFrame[] = [...flamegraph.root.children];
  while (frames.length > 0) {
    const frame = frames.pop()!;
    if (
      focusFrame.name === frame.frame.name &&
      // the image name on a frame is optional,
      // treat it the same as the empty string
      focusFrame.package === (frame.frame.image || '') &&
      (longestFrame?.node?.totalWeight || 0) < frame.node.totalWeight
    ) {
      longestFrame = frame;
    }

    for (let i = 0; i < frame.children.length; i++) {
      frames.push(frame.children[i]);
    }
  }

  return longestFrame;
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
  const [state] = useFlamegraphState();
  const dispatch = useDispatchFlamegraphState();
  const [profileGroup, setProfileGroup] = useState<ProfileGroup>(LoadingGroup);

  useEffect(() => {
    if (!props.input) {
      return;
    }

    setProfileGroup(importProfile(props.input, props.traceID));
  }, [props.input, props.traceID]);

  useEffect(() => {
    const threadId =
      typeof profileGroup.activeProfileIndex === 'number'
        ? profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId
        : null;

    // if the state has a highlight frame specified, then we want to jump to the
    // thread containing it, highlight the frames on the thread, and change the
    // view so it's obvious where it is
    if (state.profiles.highlightFrames) {
      const candidate = profileGroup.profiles.reduce<FlamegraphCandidate | null>(
        (prevCandidate, profile) => {
          // if the previous candidate is the active thread, it always takes priority
          if (prevCandidate?.isActiveThread) {
            return prevCandidate;
          }

          const flamegraph = new Flamegraph(profile, profile.threadId, {
            inverted: false,
            leftHeavy: false,
            configSpace: undefined,
          });

          const frame = findLongestMatchingFrame(
            flamegraph,
            state.profiles.highlightFrames
          );

          if (!defined(frame)) {
            return prevCandidate;
          }

          const newScore = frame.node.totalWeight || 0;
          const oldScore = prevCandidate?.frame?.node?.totalWeight || 0;

          // if we find the frame on the active thread, it always takes priority
          if (newScore > 0 && profile.threadId === threadId) {
            return {
              frame,
              threadId: profile.threadId,
              isActiveThread: true,
            };
          }

          return newScore <= oldScore
            ? prevCandidate
            : {
                frame,
                threadId: profile.threadId,
              };
        },
        null
      );

      if (defined(candidate)) {
        dispatch({
          type: 'set thread id',
          payload: candidate.threadId,
        });
        return;
      }
    }

    // fall back case, when we finally load the active profile index from the profile,
    // make sure we update the thread id so that it is show first
    if (defined(threadId)) {
      dispatch({
        type: 'set thread id',
        payload: threadId,
      });
    }
  }, [profileGroup, state.profiles.highlightFrames, dispatch]);

  return (
    <ProfileGroupContext.Provider value={profileGroup}>
      {props.children}
    </ProfileGroupContext.Provider>
  );
}
