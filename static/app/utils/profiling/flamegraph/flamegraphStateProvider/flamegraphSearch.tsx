import type Fuse from 'fuse.js';

import {FlamegraphFrame} from '../../flamegraphFrame';

export type FlamegraphSearchResult = {
  frame: FlamegraphFrame;
  matchIndices: Fuse.RangeTuple[];
};

export type FlamegraphSearch = {
  index: number | null;
  query: string;
  results: Record<string, FlamegraphSearchResult> | null;
};

type ClearFlamegraphSearchAction = {
  type: 'clear search';
};

type SetFlamegraphResultsAction = {
  payload: {
    query: string;
    results: FlamegraphSearch['results'];
  };
  type: 'set results';
};

type FlamegraphSearchArrowNavigationAction = {
  payload: number;
  type: 'set search index position';
};

type FlamegraphSearchAction =
  | ClearFlamegraphSearchAction
  | FlamegraphSearchArrowNavigationAction
  | SetFlamegraphResultsAction;

export function flamegraphSearchReducer(
  state: FlamegraphSearch,
  action: FlamegraphSearchAction
): FlamegraphSearch {
  switch (action.type) {
    case 'clear search': {
      return {
        ...state,
        query: '',
        index: null,
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
