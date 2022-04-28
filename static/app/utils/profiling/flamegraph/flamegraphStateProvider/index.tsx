import {createContext, useEffect} from 'react';
import {browserHistory} from 'react-router';
import {Query} from 'history';

import {DeepPartial} from 'sentry/types/utils';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {makeCombinedReducers} from 'sentry/utils/useCombinedReducer';
import {useLocation} from 'sentry/utils/useLocation';
import {
  UndoableReducer,
  UndoableReducerAction,
  useUndoableReducer,
} from 'sentry/utils/useUndoableReducer';

import {useFlamegraphStateValue} from '../useFlamegraphState';

<<<<<<< HEAD
import {
  FlamegraphAxisOptions,
  FlamegraphColorCodings,
  flamegraphPreferencesReducer,
  FlamegraphSorting,
  FlamegraphViewOptions,
} from './flamegraphPreferences';
=======
import {flamegraphPreferencesReducer} from './flamegraphPreferences';
>>>>>>> dc008d6bf7 (feat(profiling): add encode/decode state utility fns)
import {flamegraphProfilesReducer} from './flamegraphProfiles';
import {flamegraphSearchReducer} from './flamegraphSearch';
import {flamegraphZoomPositionReducer} from './flamegraphZoomPosition';

// Intersect the types so we can properly guard
type PossibleQuery =
  | Query
  | (Pick<FlamegraphState['preferences'], 'colorCoding' | 'sorting' | 'view' | 'xAxis'> &
      Pick<FlamegraphState['search'], 'query'>);

function isColorCoding(
  value: PossibleQuery['colorCoding'] | FlamegraphState['preferences']['colorCoding']
): value is FlamegraphState['preferences']['colorCoding'] {
<<<<<<< HEAD
  const values: FlamegraphColorCodings = [
    'by symbol name',
    'by system / application',
    'by library',
    'by recursion',
  ];

  return values.includes(value as any);
=======
  return (
    value === 'by symbol name' ||
    value === 'by library' ||
    value === 'by recursion' ||
    value === 'by system / application'
  );
>>>>>>> dc008d6bf7 (feat(profiling): add encode/decode state utility fns)
}

function isSorting(
  value: PossibleQuery['sorting'] | FlamegraphState['preferences']['sorting']
): value is FlamegraphState['preferences']['sorting'] {
<<<<<<< HEAD
  const values: FlamegraphSorting = ['left heavy', 'call order'];
  return values.includes(value as any);
=======
  return value === 'left heavy' || value === 'call order';
>>>>>>> dc008d6bf7 (feat(profiling): add encode/decode state utility fns)
}

function isView(
  value: PossibleQuery['view'] | FlamegraphState['preferences']['view']
): value is FlamegraphState['preferences']['view'] {
<<<<<<< HEAD
  const values: FlamegraphViewOptions = ['top down', 'bottom up'];
  return values.includes(value as any);
=======
  return value === 'top down' || value === 'bottom up';
>>>>>>> dc008d6bf7 (feat(profiling): add encode/decode state utility fns)
}

function isXAxis(
  value: PossibleQuery['xAxis'] | FlamegraphState['preferences']['xAxis']
): value is FlamegraphState['preferences']['xAxis'] {
<<<<<<< HEAD
  const values: FlamegraphAxisOptions = ['standalone', 'transaction'];
  return values.includes(value as any);
=======
  return value === 'standalone' || value === 'transaction';
>>>>>>> dc008d6bf7 (feat(profiling): add encode/decode state utility fns)
}

export function decodeFlamegraphStateFromQueryParams(
  query: Query
): DeepPartial<FlamegraphState> {
  return {
    profiles: {
      activeProfileIndex:
        typeof query.profileIndex === 'string' && !isNaN(parseInt(query.profileIndex, 10))
          ? parseInt(query.profileIndex, 10)
          : null,
    },
    position: {view: Rect.decode(query.fov) ?? Rect.Empty()},
    preferences: {
      colorCoding: isColorCoding(query.colorCoding)
        ? query.colorCoding
        : DEFAULT_FLAMEGRAPH_STATE.preferences.colorCoding,
      sorting: isSorting(query.sorting)
        ? query.sorting
        : DEFAULT_FLAMEGRAPH_STATE.preferences.sorting,
      view: isView(query.view) ? query.view : DEFAULT_FLAMEGRAPH_STATE.preferences.view,
      xAxis: isXAxis(query.xAxis)
        ? query.xAxis
        : DEFAULT_FLAMEGRAPH_STATE.preferences.xAxis,
    },
    search: {
      query: typeof query.query === 'string' ? query.query : '',
    },
  };
}

function encodeFlamegraphStateToQueryParams(state: FlamegraphState) {
  return {
    colorCoding: state.preferences.colorCoding,
    sorting: state.preferences.sorting,
    view: state.preferences.view,
    xAxis: state.preferences.xAxis,
    query: state.search.query,
    ...(state.position.view.isEmpty()
      ? {fov: undefined}
      : {fov: Rect.encode(state.position.view)}),
    ...(typeof state.profiles.activeProfileIndex === 'number'
      ? {profileIndex: state.profiles.activeProfileIndex}
      : {}),
  };
}

export const combinedReducers = makeCombinedReducers({
  profiles: flamegraphProfilesReducer,
  position: flamegraphZoomPositionReducer,
  preferences: flamegraphPreferencesReducer,
  search: flamegraphSearchReducer,
});

export type FlamegraphState = React.ReducerState<FlamegraphStateReducer>['current'];
type FlamegraphAction = React.Dispatch<
  UndoableReducerAction<React.ReducerAction<FlamegraphStateReducer>>
>;

type FlamegraphStateReducer = UndoableReducer<typeof combinedReducers>;

export function FlamegraphStateQueryParamSync() {
  const location = useLocation();
  const state = useFlamegraphStateValue();

  useEffect(() => {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        ...encodeFlamegraphStateToQueryParams(state),
      },
    });
    // We only want to sync the query params when the state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return null;
}

export type FlamegraphStateContextValue = [
  FlamegraphState,
  FlamegraphAction,
  {
    nextState: FlamegraphState | undefined;
    previousState: FlamegraphState | undefined;
  }
];

export const FlamegraphStateContext = createContext<FlamegraphStateContextValue | null>(
  null
);
interface FlamegraphStateProviderProps {
  children: React.ReactNode;
  initialState?: DeepPartial<FlamegraphState>;
}

const DEFAULT_FLAMEGRAPH_STATE: FlamegraphState = {
  profiles: {
    activeProfileIndex: null,
  },
  position: {
    view: Rect.Empty(),
  },
  preferences: {
    colorCoding: 'by symbol name',
    sorting: 'call order',
    view: 'top down',
    xAxis: 'standalone',
  },
  search: {
    index: null,
    results: null,
    query: '',
  },
};

export function FlamegraphStateProvider(
  props: FlamegraphStateProviderProps
): React.ReactElement {
  const reducer = useUndoableReducer(combinedReducers, {
    profiles: {
<<<<<<< HEAD
      activeProfileIndex:
        props.initialState?.profiles?.activeProfileIndex ??
        DEFAULT_FLAMEGRAPH_STATE.profiles.activeProfileIndex,
    },
    position: {
      view: (props.initialState?.position?.view ??
        DEFAULT_FLAMEGRAPH_STATE.position.view) as Rect,
    },
    preferences: {
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
=======
      ...DEFAULT_FLAMEGRAPH_STATE.profiles,
      ...(props.initialState?.profiles ?? {}),
    },
    // @ts-ignore the view here never gets override, it's set as a default in the DEFAULT_FLAMEGRAPH_STATE
    position: {
      ...DEFAULT_FLAMEGRAPH_STATE.position,
      ...(props.initialState?.position ?? {}),
    },
    preferences: {
      ...DEFAULT_FLAMEGRAPH_STATE.preferences,
      ...(props.initialState?.preferences ?? {}),
    },
    search: {
      ...DEFAULT_FLAMEGRAPH_STATE.search,
      ...(props.initialState?.search ?? {}),
      results: null,
>>>>>>> dc008d6bf7 (feat(profiling): add encode/decode state utility fns)
    },
  });

  return (
    <FlamegraphStateContext.Provider value={reducer}>
      {props.children}
    </FlamegraphStateContext.Provider>
  );
}
