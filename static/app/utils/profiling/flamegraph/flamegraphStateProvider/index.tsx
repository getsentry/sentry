import {createContext, useEffect} from 'react';
import {browserHistory} from 'react-router';
import type {Query} from 'history';

import type {DeepPartial} from 'sentry/types/utils';
import {defined} from 'sentry/utils';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {makeCombinedReducers} from 'sentry/utils/useCombinedReducer';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import type {
  UndoableReducer,
  UndoableReducerAction,
} from 'sentry/utils/useUndoableReducer';
import {useUndoableReducer} from 'sentry/utils/useUndoableReducer';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {useFlamegraphStateValue} from '../useFlamegraphState';

import type {
  FlamegraphAxisOptions,
  FlamegraphColorCodings,
  FlamegraphSorting,
  FlamegraphViewOptions,
} from './flamegraphPreferences';
import {flamegraphPreferencesReducer} from './flamegraphPreferences';
import type {FlamegraphProfiles} from './flamegraphProfiles';
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
  const values: FlamegraphColorCodings = [
    'by symbol name',
    'by system / application',
    'by library',
    'by recursion',
    'by frequency',
  ];

  return values.includes(value as any);
}

function isLayout(
  value: PossibleQuery['colorCoding'] | FlamegraphState['preferences']['colorCoding']
): value is FlamegraphState['preferences']['layout'] {
  return value === 'table right' || value === 'table bottom' || value === 'table left';
}

function isSorting(
  value: PossibleQuery['sorting'] | FlamegraphState['preferences']['sorting']
): value is FlamegraphState['preferences']['sorting'] {
  const values: FlamegraphSorting = ['left heavy', 'call order'];
  return values.includes(value as any);
}

function isView(
  value: PossibleQuery['view'] | FlamegraphState['preferences']['view']
): value is FlamegraphState['preferences']['view'] {
  const values: FlamegraphViewOptions = ['top down', 'bottom up'];
  return values.includes(value as any);
}

function isXAxis(
  value: PossibleQuery['xAxis'] | FlamegraphState['preferences']['xAxis']
): value is FlamegraphState['preferences']['xAxis'] {
  const values: FlamegraphAxisOptions = ['standalone', 'transaction'];
  return values.includes(value as any);
}

export function decodeFlamegraphStateFromQueryParams(
  query: Query
): DeepPartial<FlamegraphState> {
  return {
    profiles: {
      focusFrame:
        typeof query.frameName === 'string' && typeof query.framePackage === 'string'
          ? {
              name: query.frameName,
              package: query.framePackage,
            }
          : null,
      threadId:
        typeof query.tid === 'string' && !isNaN(parseInt(query.tid, 10))
          ? parseInt(query.tid, 10)
          : null,
    },
    position: {view: Rect.decode(query.fov) ?? Rect.Empty()},
    preferences: {
      layout: isLayout(query.layout)
        ? query.layout
        : DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
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

export function encodeFlamegraphStateToQueryParams(state: FlamegraphState) {
  return {
    colorCoding: state.preferences.colorCoding,
    sorting: state.preferences.sorting,
    view: state.preferences.view,
    xAxis: state.preferences.xAxis,
    query: state.search.query,
    ...(state.position.view.isEmpty()
      ? {fov: undefined}
      : {fov: Rect.encode(state.position.view)}),
    ...(typeof state.profiles.threadId === 'number'
      ? {tid: state.profiles.threadId}
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
    browserHistory.replace({
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

export const FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY = 'flamegraph-preferences';
export function FlamegraphStateLocalStorageSync() {
  const state = useFlamegraphStateValue();
  const [_, setState] = useLocalStorageState<DeepPartial<FlamegraphState>>(
    FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY,
    {
      preferences: {
        layout: DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
      },
    }
  );

  useEffect(() => {
    setState({
      preferences: {
        layout: state.preferences.layout,
      },
    });
    // We only want to sync the local storage when the state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.preferences.layout]);

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

export const DEFAULT_FLAMEGRAPH_STATE: FlamegraphState = {
  profiles: {
    selectedRoot: null,
    threadId: null,
    focusFrame: null,
  },
  position: {
    view: Rect.Empty(),
  },
  preferences: {
    colorCoding: 'by symbol name',
    sorting: 'call order',
    view: 'top down',
    xAxis: 'standalone',
    layout: 'table bottom',
  },
  search: {
    index: null,
    results: new Map(),
    query: '',
  },
};

export function FlamegraphStateProvider(
  props: FlamegraphStateProviderProps
): React.ReactElement {
  const [profileGroup] = useProfileGroup();

  const reducer = useUndoableReducer(combinedReducers, {
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
  });

  useEffect(() => {
    if (reducer[0].profiles.threadId === null && profileGroup.type === 'resolved') {
      /**
       * When a focus frame is specified, we need to override the active thread.
       * We look at each thread and pick the one that scores the highest.
       */
      if (defined(reducer[0].profiles.focusFrame)) {
        const candidate = profileGroup.data.profiles.reduce(
          (prevCandidate, profile) => {
            const flamegraph = new Flamegraph(profile, profile.threadId, {
              inverted: false,
              leftHeavy: false,
              configSpace: undefined,
            });

            const score = scoreFlamegraph(flamegraph, reducer[0].profiles.focusFrame);

            return score <= prevCandidate.score
              ? prevCandidate
              : {
                  score,
                  threadId: profile.threadId,
                };
          },
          {score: 0, threadId: null} as Candidate
        );

        if (defined(candidate.threadId)) {
          reducer[1]({type: 'set thread id', payload: candidate.threadId});
          return;
        }
      }

      if (typeof profileGroup.data.activeProfileIndex === 'number') {
        const threadID =
          profileGroup.data.profiles[profileGroup.data.activeProfileIndex].threadId;

        if (threadID) {
          reducer[1]({
            type: 'set thread id',
            payload: threadID,
          });
        }
      }
    }
  }, [props.initialState?.profiles?.threadId, profileGroup, reducer]);

  return (
    <FlamegraphStateContext.Provider value={reducer}>
      {props.children}
    </FlamegraphStateContext.Provider>
  );
}

type Candidate = {
  score: number;
  threadId: number | null;
};

function scoreFlamegraph(
  flamegraph: Flamegraph,
  focusFrame: FlamegraphProfiles['focusFrame']
): number {
  if (!defined(focusFrame)) {
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
