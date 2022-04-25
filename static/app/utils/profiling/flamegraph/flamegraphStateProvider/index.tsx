import {createContext} from 'react';

import {Rect} from 'sentry/utils/profiling/gl/utils';
import {makeCombinedReducers} from 'sentry/utils/useCombinedReducer';
import {
  UndoableReducer,
  UndoableReducerAction,
  useUndoableReducer,
} from 'sentry/utils/useUndoableReducer';

import {flamegraphPreferencesReducer} from './flamegraphPreferences';
import {flamegraphSearchReducer} from './flamegraphSearch';
import {flamegraphZoomPositionReducer} from './flamegraphZoomPosition';

export const combinedReducers = makeCombinedReducers({
  position: flamegraphZoomPositionReducer,
  preferences: flamegraphPreferencesReducer,
  search: flamegraphSearchReducer,
});

type FlamegraphState = React.ReducerState<FlamegraphStateReducer>['current'];

type FlamegraphAction = React.Dispatch<
  UndoableReducerAction<React.ReducerAction<FlamegraphStateReducer>>
>;

type FlamegraphStateReducer = UndoableReducer<typeof combinedReducers>;

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
}

export function FlamegraphStateProvider(
  props: FlamegraphStateProviderProps
): React.ReactElement {
  const reducer = useUndoableReducer(combinedReducers, {
    position: {
      view: Rect.Empty(),
    },
    preferences: {
      colorCoding: 'by symbol name',
      sorting: 'call order',
      view: 'top down',
      synchronizeXAxisWithTransaction: false,
    },
    search: {
      open: false,
      index: null,
      results: null,
      query: '',
    },
  });

  return (
    <FlamegraphStateContext.Provider value={reducer}>
      {props.children}
    </FlamegraphStateContext.Provider>
  );
}
