import {useMemo} from 'react';

import {DeepPartial} from 'sentry/types/utils';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {useUndoableReducer} from 'sentry/utils/useUndoableReducer';

import {FlamegraphProfiles} from './reducers/flamegraphProfiles';
import {
  DEFAULT_FLAMEGRAPH_STATE,
  FlamegraphState,
  FlamegraphStateDispatchContext,
  flamegraphStateReducer,
  FlamegraphStateValue,
  FlamegraphStateValueContext,
} from './flamegraphContext';

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
      },
      position: {
        view: (props.initialState?.position?.view ??
          DEFAULT_FLAMEGRAPH_STATE.position.view) as Rect,
      },
      preferences: {
        type:
          props.initialState?.preferences?.type ??
          DEFAULT_FLAMEGRAPH_STATE.preferences.type,
        timelines: {
          ...DEFAULT_FLAMEGRAPH_STATE.preferences.timelines,
          ...(props.initialState?.preferences?.timelines ?? {}),
        },
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

  const flamegraphContextValue: FlamegraphStateValue = useMemo(() => {
    return [state, {nextState, previousState}];
  }, [state, nextState, previousState]);

  return (
    <FlamegraphStateValueContext.Provider value={flamegraphContextValue}>
      <FlamegraphStateDispatchContext.Provider value={dispatch}>
        {props.children}
      </FlamegraphStateDispatchContext.Provider>
    </FlamegraphStateValueContext.Provider>
  );
}
