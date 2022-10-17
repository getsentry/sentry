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
  score: number;
  threadId: number | null;
};

function scoreFlamegraph(
  flamegraph: Flamegraph,
  focusFrame: FlamegraphProfiles['highlightFrame']
): number {
  if (focusFrame === null) {
    return 0;
  }

  let score = 0;

  const frames: FlamegraphFrame[] = [...flamegraph.root.children];
  while (frames.length > 0) {
    const frame = frames.pop()!;
    if (
      frame.frame.name === focusFrame.name &&
      frame.frame.image === focusFrame.package
    ) {
      score += frame.node.totalWeight;
    }

    for (let i = 0; i < frame.children.length; i++) {
      frames.push(frame.children[i]);
    }
  }

  return score;
}

function isValidHighlightFrame(
  frame: Partial<FlamegraphProfiles['highlightFrame']> | null | undefined
): frame is NonNullable<FlamegraphProfiles['highlightFrame']> {
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
        highlightFrame: isValidHighlightFrame(
          props.initialState?.profiles?.highlightFrame
        )
          ? (props.initialState?.profiles
              ?.highlightFrame as FlamegraphProfiles['highlightFrame'])
          : isValidHighlightFrame(DEFAULT_FLAMEGRAPH_STATE.profiles.highlightFrame)
          ? DEFAULT_FLAMEGRAPH_STATE.profiles.highlightFrame
          : null,
        selectedRoot: null,
        threadId:
          props.initialState?.profiles?.threadId ??
          DEFAULT_FLAMEGRAPH_STATE.profiles.threadId,
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
    if (state.profiles.threadId === null) {
      if (state.profiles.highlightFrame && profileGroup.type === 'resolved') {
        const candidate = profileGroup.data.profiles.reduce<FlamegraphCandidate>(
          (prevCandidate, profile) => {
            const flamegraph = new Flamegraph(profile, profile.threadId, {
              inverted: false,
              leftHeavy: false,
              configSpace: undefined,
            });

            const score = scoreFlamegraph(flamegraph, state.profiles.highlightFrame);

            return score <= prevCandidate.score
              ? prevCandidate
              : {
                  score,
                  threadId: profile.threadId,
                };
          },
          {score: 0, threadId: null}
        );

        if (typeof candidate.threadId === 'number') {
          dispatch({type: 'set thread id', payload: candidate.threadId});
          return;
        }
      }

      if (
        profileGroup.type === 'resolved' &&
        typeof profileGroup.data.activeProfileIndex === 'number'
      ) {
        const threadID =
          profileGroup.data.profiles[profileGroup.data.activeProfileIndex].threadId;

        if (defined(threadID)) {
          dispatch({
            type: 'set thread id',
            payload: threadID,
          });
        }
      }
    }
  }, [
    props.initialState?.profiles?.threadId,
    profileGroup,
    state,
    dispatch,
    state.profiles.highlightFrame,
  ]);

  return (
    <FlamegraphStateValueContext.Provider value={[state, {nextState, previousState}]}>
      <FlamegraphStateDispatchContext.Provider value={dispatch}>
        {props.children}
      </FlamegraphStateDispatchContext.Provider>
    </FlamegraphStateValueContext.Provider>
  );
}
