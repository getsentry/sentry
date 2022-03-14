import React, {createContext, useReducer} from 'react';

import {FlamegraphFrame} from '../flamegraphFrame';

const exhaustiveCheck = (x: never) => void x;

export type FlamegraphState = {
  search: {
    index: number | null;
    open: boolean;
    query: string;
    results: Record<string, FlamegraphFrame> | null;
  };
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
    results: FlamegraphState['search']['results'];
  };
  type: 'set results';
};

type FlamegraphSearchArrowNavigationAction = {
  payload: number;
  type: 'set search index position';
};

export type FlamegraphStateAction =
  | OpenFlamegraphSearchAction
  | CloseFlamegraphSearchAction
  | ClearFlamegraphSearchAction
  | FlamegraphSearchArrowNavigationAction
  | SetFlamegraphResultsAction;

export const flamegraphReducer: React.Reducer<FlamegraphState, FlamegraphStateAction> = (
  state,
  action
): FlamegraphState => {
  switch (action.type) {
    case 'open search': {
      return {...state, search: {...state.search, open: true}};
    }
    case 'close search': {
      return {...state, search: {...state.search, open: false}};
    }
    case 'clear search': {
      return {
        ...state,
        search: {
          query: '',
          index: null,
          open: action.payload?.open ?? false,
          results: null,
        },
      };
    }
    case 'set results': {
      return {...state, search: {...state.search, ...action.payload}};
    }
    case 'set search index position': {
      return {...state, search: {...state.search, index: action.payload}};
    }
    default: {
      exhaustiveCheck(action);
      return state;
    }
  }
};

type FlamegraphStateContextValue = [
  FlamegraphState,
  React.Dispatch<FlamegraphStateAction>
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
  const reducer = useReducer(flamegraphReducer, {
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
