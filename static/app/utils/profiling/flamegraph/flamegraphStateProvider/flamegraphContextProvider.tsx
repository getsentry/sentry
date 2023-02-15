import {useMemo} from 'react';

import {DeepPartial} from 'sentry/types/utils';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
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

function getAxisForType(
  type: FlamegraphPreferences['type'],
  xAxis: FlamegraphPreferences['xAxis']
): FlamegraphPreferences['xAxis'] {
  if (type === 'flamegraph') {
    return 'profile';
  }
  return xAxis;
}

function getSortingForType(
  type: FlamegraphPreferences['type'],
  sorting: FlamegraphPreferences['sorting']
): FlamegraphPreferences['sorting'] {
  if (type === 'flamegraph' && sorting === 'call order') {
    return 'alphabetical';
  }
  if (type === 'flamechart' && sorting === 'alphabetical') {
    return 'call order';
  }
  return sorting;
}

interface FlamegraphStateProviderProps {
  children: React.ReactNode;
  initialState?: DeepPartial<FlamegraphState>;
}

function getDefaultState(initialState?: DeepPartial<FlamegraphState>): FlamegraphState {
  const type =
    initialState?.preferences?.type ?? DEFAULT_FLAMEGRAPH_STATE.preferences.type;

  const xAxis = getAxisForType(
    type,
    initialState?.preferences?.xAxis ?? DEFAULT_FLAMEGRAPH_STATE.preferences.xAxis
  );
  const sorting = getSortingForType(
    type,
    initialState?.preferences?.sorting ?? DEFAULT_FLAMEGRAPH_STATE.preferences.sorting
  );

  return {
    profiles: {
      highlightFrames: isValidHighlightFrame(initialState?.profiles?.highlightFrames)
        ? (initialState?.profiles
            ?.highlightFrames as FlamegraphProfiles['highlightFrames'])
        : isValidHighlightFrame(DEFAULT_FLAMEGRAPH_STATE.profiles.highlightFrames)
        ? DEFAULT_FLAMEGRAPH_STATE.profiles.highlightFrames
        : null,
      selectedRoot: null,
      threadId:
        initialState?.profiles?.threadId ?? DEFAULT_FLAMEGRAPH_STATE.profiles.threadId,
    },
    position: {
      view: (initialState?.position?.view ??
        DEFAULT_FLAMEGRAPH_STATE.position.view) as Rect,
    },
    preferences: {
      type: initialState?.preferences?.type ?? DEFAULT_FLAMEGRAPH_STATE.preferences.type,
      timelines: {
        ...DEFAULT_FLAMEGRAPH_STATE.preferences.timelines,
        ...(initialState?.preferences?.timelines ?? {}),
      },
      layout:
        initialState?.preferences?.layout ?? DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
      colorCoding:
        initialState?.preferences?.colorCoding ??
        DEFAULT_FLAMEGRAPH_STATE.preferences.colorCoding,
      sorting,
      view: initialState?.preferences?.view ?? DEFAULT_FLAMEGRAPH_STATE.preferences.view,
      xAxis,
    },
    search: {
      ...DEFAULT_FLAMEGRAPH_STATE.search,
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
