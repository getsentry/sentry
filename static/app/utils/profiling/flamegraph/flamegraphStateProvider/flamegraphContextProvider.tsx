import {useEffect} from 'react';

import {DeepPartial} from 'sentry/types/utils';
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

type Candidate = {
  score: number;
  threadId: number | null;
};

function scoreFlamegraph(
  flamegraph: Flamegraph,
  focusFrame: FlamegraphProfiles['focusFrame']
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
        focusFrame:
          props.initialState?.profiles?.focusFrame?.name &&
          props.initialState?.profiles?.focusFrame?.package
            ? {
                name: props.initialState.profiles.focusFrame.name,
                package: props.initialState.profiles.focusFrame.package,
              }
            : DEFAULT_FLAMEGRAPH_STATE.profiles.focusFrame,
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
    if (state.profiles.threadId === null && profileGroup.type === 'resolved') {
      /**
       * When a focus frame is specified, we need to override the active thread.
       * We look at each thread and pick the one that scores the highest.
       */
      if (state.profiles.focusFrame !== undefined) {
        const candidate = profileGroup.data.profiles.reduce(
          (prevCandidate, profile) => {
            const flamegraph = new Flamegraph(profile, profile.threadId, {
              inverted: false,
              leftHeavy: false,
              configSpace: undefined,
            });

            const score = scoreFlamegraph(flamegraph, state.profiles.focusFrame);

            return score <= prevCandidate.score
              ? prevCandidate
              : {
                  score,
                  threadId: profile.threadId,
                };
          },
          {score: 0, threadId: null} as Candidate
        );

        if (candidate.threadId !== null) {
          dispatch({type: 'set thread id', payload: candidate.threadId});
          return;
        }
      }

      if (typeof profileGroup.data.activeProfileIndex === 'number') {
        const threadID =
          profileGroup.data.profiles[profileGroup.data.activeProfileIndex].threadId;

        if (threadID) {
          dispatch({
            type: 'set thread id',
            payload: threadID,
          });
        }
      }
    }
  }, [props.initialState?.profiles?.threadId, profileGroup, state, dispatch]);

  return (
    <FlamegraphStateValueContext.Provider value={[state, {nextState, previousState}]}>
      <FlamegraphStateDispatchContext.Provider value={dispatch}>
        {props.children}
      </FlamegraphStateDispatchContext.Provider>
    </FlamegraphStateValueContext.Provider>
  );
}
