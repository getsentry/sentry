import React, {ReducerAction, ReducerState} from 'react';

import {makeCombinedReducers} from 'sentry/utils/useCombinedReducer';
import {
  UndoableReducer,
  UndoableReducerAction,
  useUndoableReducer,
} from 'sentry/utils/useUndoableReducer';

import {FlamegraphFrame} from '../flamegraphFrame';

export interface FlamegraphPreferences {
  colorCoding:
    | 'by symbol name'
    | 'by system / application'
    | 'by library'
    | 'by recursion';
  sorting: 'left heavy' | 'call order';
  view: 'top down' | 'bottom up';
}

type FlamegraphPreferencesAction =
  | {payload: FlamegraphPreferences['colorCoding']; type: 'set color coding'}
  | {payload: FlamegraphPreferences['sorting']; type: 'set sorting'}
  | {payload: FlamegraphPreferences['view']; type: 'set view'};

function flamegraphPreferencesReducer(
  state: FlamegraphPreferences,
  action: FlamegraphPreferencesAction
): FlamegraphPreferences {
  switch (action.type) {
    case 'set color coding': {
      return {
        ...state,
        colorCoding: action.payload,
      };
    }
    case 'set sorting': {
      return {
        ...state,
        sorting: action.payload,
      };
    }
    case 'set view': {
      return {
        ...state,
        view: action.payload,
      };
    }
    default: {
      return state;
    }
  }
}

type FlamegraphSearchState = {
  index: number | null;
  open: boolean;
  query: string;
  results: Record<string, FlamegraphFrame> | null;
};

type OpenFlamegraphSearchAction = {
  type: 'open search';
};

type CloseFlamegraphSearchAction = {
  type: 'close search';
};

type ClearFlamegraphSearchAction = {
  type: 'clear search';
  payload?: {
    open?: boolean;
  };
};

type SetFlamegraphResultsAction = {
  payload: {
    query: string;
    results: FlamegraphSearchState['results'];
  };
  type: 'set results';
};

type FlamegraphSearchArrowNavigationAction = {
  payload: number;
  type: 'set search index position';
};

type FlamegraphStateAction =
  | OpenFlamegraphSearchAction
  | CloseFlamegraphSearchAction
  | ClearFlamegraphSearchAction
  | FlamegraphSearchArrowNavigationAction
  | SetFlamegraphResultsAction;

function flamegraphSearchReducer(
  state: FlamegraphSearchState,
  action: FlamegraphStateAction
): FlamegraphSearchState {
  switch (action.type) {
    case 'open search': {
      return {...state, open: true};
    }
    case 'close search': {
      return {...state, open: false};
    }
    case 'clear search': {
      return {
        ...state,
        query: '',
        index: null,
        open: action.payload?.open ?? false,
        results: null,
      };
    }
    case 'set results': {
      return {...state, ...action.payload};
    }
    case 'set search index position': {
      return {...state, index: action.payload};
    }
    default: {
      return state;
    }
  }
}

export const combinedReducers = makeCombinedReducers({
  search: flamegraphSearchReducer,
  preferences: flamegraphPreferencesReducer,
});

type FlamegraphState = ReducerState<FlamegraphStateReducer>['current'];
type FlamegraphAction = React.Dispatch<
  UndoableReducerAction<ReducerAction<FlamegraphStateReducer>>
>;
type FlamegraphStateReducer = UndoableReducer<typeof combinedReducers>;
export type FlamegraphStateContextValue = [FlamegraphState, FlamegraphAction];

export const FlamegraphStateContext =
  React.createContext<FlamegraphStateContextValue | null>(null);

interface FlamegraphStateProviderProps {
  children: React.ReactNode;
}

export function FlamegraphStateProvider(
  props: FlamegraphStateProviderProps
): React.ReactElement {
  const reducer = useUndoableReducer(combinedReducers, {
    preferences: {
      colorCoding: 'by symbol name',
      sorting: 'call order',
      view: 'top down',
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
