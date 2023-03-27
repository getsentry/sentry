import {useMemo} from 'react';

import {DeepPartial} from 'sentry/types/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {useUndoableReducer} from 'sentry/utils/useUndoableReducer';

import {FlamegraphSearch} from './reducers/flamegraphSearch';
import {
  DEFAULT_FLAMEGRAPH_STATE,
  FlamegraphState,
  FlamegraphStateDispatchContext,
  flamegraphStateReducer,
  FlamegraphStateValue,
  FlamegraphStateValueContext,
} from './flamegraphContext';

function isValidHighlightFrame(
  frame: Partial<FlamegraphSearch['highlightFrames']> | null | undefined
): frame is FlamegraphSearch['highlightFrames'] {
  return !!frame && (typeof frame.name === 'string' || typeof frame.package === 'string');
}

interface FlamegraphStateProviderProps {
  children: React.ReactNode;
  initialState?: DeepPartial<FlamegraphState>;
}

function getDefaultState(initialState?: DeepPartial<FlamegraphState>): FlamegraphState {
  return {
    profiles: {
      selectedRoot: null,
      threadId:
        initialState?.profiles?.threadId ?? DEFAULT_FLAMEGRAPH_STATE.profiles.threadId,
    },
    position: {
      view: (initialState?.position?.view ??
        DEFAULT_FLAMEGRAPH_STATE.position.view) as Rect,
    },
    preferences: {
      timelines: {
        ...DEFAULT_FLAMEGRAPH_STATE.preferences.timelines,
        ...(initialState?.preferences?.timelines ?? {}),
      },
      layout:
        initialState?.preferences?.layout ?? DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
      colorCoding:
        initialState?.preferences?.colorCoding ??
        DEFAULT_FLAMEGRAPH_STATE.preferences.colorCoding,
      sorting:
        initialState?.preferences?.sorting ??
        DEFAULT_FLAMEGRAPH_STATE.preferences.sorting,
      view: initialState?.preferences?.view ?? DEFAULT_FLAMEGRAPH_STATE.preferences.view,
    },
    search: {
      ...DEFAULT_FLAMEGRAPH_STATE.search,
      highlightFrames: isValidHighlightFrame(initialState?.search?.highlightFrames)
        ? {
            name: undefined,
            package: undefined,
            ...initialState?.search?.highlightFrames,
          }
        : isValidHighlightFrame(DEFAULT_FLAMEGRAPH_STATE.search.highlightFrames)
        ? DEFAULT_FLAMEGRAPH_STATE.search.highlightFrames
        : null,
      query: initialState?.search?.query ?? DEFAULT_FLAMEGRAPH_STATE.search.query,
    },
  };
}

export function FlamegraphStateProvider(
  props: FlamegraphStateProviderProps
): React.ReactElement {
  const [state, dispatch, {nextState, previousState}] = useUndoableReducer(
    flamegraphStateReducer,
    getDefaultState(props.initialState)
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
