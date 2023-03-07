import {createContext} from 'react';

import {Rect} from 'sentry/utils/profiling/gl/utils';
import {makeCombinedReducers} from 'sentry/utils/useCombinedReducer';
import {UndoableReducer, UndoableReducerAction} from 'sentry/utils/useUndoableReducer';

import {flamegraphPreferencesReducer} from './reducers/flamegraphPreferences';
import {flamegraphProfilesReducer} from './reducers/flamegraphProfiles';
import {flamegraphSearchReducer} from './reducers/flamegraphSearch';
import {flamegraphZoomPositionReducer} from './reducers/flamegraphZoomPosition';

export const DEFAULT_FLAMEGRAPH_STATE: FlamegraphState = {
  profiles: {
    selectedRoot: null,
    threadId: null,
    highlightFrames: null,
  },
  position: {
    view: Rect.Empty(),
  },
  preferences: {
    timelines: {
      ui_frames: true,
      minimap: true,
      transaction_spans: true,
    },
    colorCoding: 'by symbol name',
    sorting: 'call order',
    view: 'top down',
    layout: 'table bottom',
  },
  search: {
    index: null,
    results: {
      frames: new Map(),
      spans: new Map(),
    },
    query: '',
  },
};

export const flamegraphStateReducer = makeCombinedReducers({
  profiles: flamegraphProfilesReducer,
  position: flamegraphZoomPositionReducer,
  preferences: flamegraphPreferencesReducer,
  search: flamegraphSearchReducer,
});

type FlamegraphReducer = UndoableReducer<typeof flamegraphStateReducer>;

export type FlamegraphState = React.ReducerState<FlamegraphReducer>['current'];
export type FlamegraphStateValue = [
  FlamegraphState,
  {
    nextState: FlamegraphState | undefined;
    previousState: FlamegraphState | undefined;
  }
];

export type FlamegraphStateDispatch = React.Dispatch<
  UndoableReducerAction<React.ReducerAction<FlamegraphReducer>>
>;

export const FlamegraphStateValueContext = createContext<FlamegraphStateValue | null>(
  null
);
export const FlamegraphStateDispatchContext =
  createContext<FlamegraphStateDispatch | null>(null);
