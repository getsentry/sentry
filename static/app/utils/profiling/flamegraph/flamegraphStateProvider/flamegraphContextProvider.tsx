import {useEffect} from 'react';

import {DeepPartial} from 'sentry/types/utils';
import {defined} from 'sentry/utils';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {useUndoableReducer} from 'sentry/utils/useUndoableReducer';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {FlamegraphProfiles} from './reducers/flamegraphProfiles';
import {
  DEFAULT_FLAMEGRAPH_STATE,
  FlamegraphState,
  FlamegraphStateDispatchContext,
  flamegraphStateReducer,
  FlamegraphStateValueContext,
} from './flamegraphContext';

type FlamegraphCandidate = {
  frame: FlamegraphFrame;
  threadId: number;
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
      (focusFrame.package || '') === frame.frame.image &&
      frame.node.totalWeight > (longestFrame?.node?.totalWeight || 0)
    ) {
      longestFrame = frame;
    }

    for (let i = 0; i < frame.children.length; i++) {
      frames.push(frame.children[i]);
    }
  }

  return longestFrame;
}

function isValidHighlightFrame(
  frame: Partial<FlamegraphProfiles['highlightFrames']> | null | undefined
): frame is NonNullable<FlamegraphProfiles['highlightFrames']> {
  return !!frame && typeof frame.name === 'string';
}

interface FlamegraphStateProviderProps {
  children: React.ReactNode;
  initialState?: DeepPartial<FlamegraphState>;
}

export function FlamegraphStateProvider(
  props: FlamegraphStateProviderProps
): React.ReactElement {
  const [profileGroup] = useProfileGroup();
  const [state, dispatch, {nextState, previousState}] = useUndoableReducer(
    flamegraphStateReducer,
    {
      profiles: {
        highlightFrames: isValidHighlightFrame(
          props.initialState?.profiles?.highlightFrames
        )
          ? (props.initialState?.profiles
              ?.highlightFrames as FlamegraphProfiles['highlightFrames'])
          : isValidHighlightFrame(DEFAULT_FLAMEGRAPH_STATE.profiles.highlightFrames)
          ? DEFAULT_FLAMEGRAPH_STATE.profiles.highlightFrames
          : null,
        selectedRoot: null,
        threadId:
          props.initialState?.profiles?.threadId ??
          DEFAULT_FLAMEGRAPH_STATE.profiles.threadId,
        zoomIntoFrame: null,
      },
      position: {
        view: (props.initialState?.position?.view ??
          DEFAULT_FLAMEGRAPH_STATE.position.view) as Rect,
      },
      preferences: {
        layout:
          props.initialState?.preferences?.layout ??
          DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
        colorCoding:
          props.initialState?.preferences?.colorCoding ??
          DEFAULT_FLAMEGRAPH_STATE.preferences.colorCoding,
        sorting:
          props.initialState?.preferences?.sorting ??
          DEFAULT_FLAMEGRAPH_STATE.preferences.sorting,
        view:
          props.initialState?.preferences?.view ??
          DEFAULT_FLAMEGRAPH_STATE.preferences.view,
        xAxis:
          props.initialState?.preferences?.xAxis ??
          DEFAULT_FLAMEGRAPH_STATE.preferences.xAxis,
      },
      search: {
        ...DEFAULT_FLAMEGRAPH_STATE.search,
        query: props.initialState?.search?.query ?? DEFAULT_FLAMEGRAPH_STATE.search.query,
      },
    }
  );

  useEffect(() => {
    if (defined(state.profiles.threadId)) {
      return;
    }

    // if the state has a highlight frame specified, then we want to jump to the
    // thread containing it, highlight the frames on the thread, and change the
    // view so it's obvious where it is
    if (state.profiles.highlightFrames && profileGroup.type === 'resolved') {
      const candidate = profileGroup.data.profiles.reduce<FlamegraphCandidate | null>(
        (prevCandidate, profile) => {
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
          type: 'jump to frame',
          payload: {
            frame: candidate.frame,
            threadId: candidate.threadId,
          },
        });
        return;
      }
    }

    // fall back case, when we finally load the active profile index from the profile,
    // make sure we update the thread id so that it is show first
    if (
      profileGroup.type === 'resolved' &&
      typeof profileGroup.data.activeProfileIndex === 'number'
    ) {
      const threadId =
        profileGroup.data.profiles[profileGroup.data.activeProfileIndex].threadId;

      if (defined(threadId)) {
        dispatch({
          type: 'set thread id',
          payload: threadId,
        });
      }
    }
  }, [
    props.initialState?.profiles?.threadId,
    profileGroup,
    state,
    dispatch,
    state.profiles.highlightFrames,
  ]);

  return (
    <FlamegraphStateValueContext.Provider value={[state, {nextState, previousState}]}>
      <FlamegraphStateDispatchContext.Provider value={dispatch}>
        {props.children}
      </FlamegraphStateDispatchContext.Provider>
    </FlamegraphStateValueContext.Provider>
  );
}
