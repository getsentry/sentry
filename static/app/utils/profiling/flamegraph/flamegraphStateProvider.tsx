import React, {createContext, useReducer} from 'react';

import {Flamegraph} from '../flamegraph';
import {FlamegraphFrame} from '../flamegraphFrame';

const exhaustiveCheck = (x: never) => void x;

export type FlamegraphState = {
  flamegraph: Flamegraph | null;
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

type FlamegraphSearchArrowNavigationAction = {
  payload: number;
  type: 'arrow navigation';
};

type SetFlamegraphAction = {
  payload: Flamegraph;
  type: 'set flamegraph';
};

export type FlamegraphStateAction =
  | OpenFlamegraphSearchAction
  | CloseFlamegraphSearchAction
  | FlamegraphSearchArrowNavigationAction
  | SetFlamegraphAction;

export const flamegraphReducer: React.Reducer<FlamegraphState, FlamegraphStateAction> = (
  state,
  action
): FlamegraphState => {
  switch (action.type) {
    case 'set flamegraph': {
      return {...state, flamegraph: action.payload};
    }
    case 'open search': {
      return {...state, search: {...state.search, open: true}};
    }
    case 'close search': {
      return {...state, search: {...state.search, open: false}};
    }
    case 'arrow navigation': {
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
    flamegraph: null,
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
