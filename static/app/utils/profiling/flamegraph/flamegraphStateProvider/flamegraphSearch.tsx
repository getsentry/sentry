import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

type FlamegraphSearch = {
  index: number | null;
  query: string;
  results: Record<string, FlamegraphFrame> | null;
};

type ClearFlamegraphSearchAction = {
  type: 'clear search';
};

type SetFlamegraphResultsAction = {
  payload: FlamegraphSearch['results'];
  type: 'set results';
};

type FlamegraphSearchArrowNavigationAction = {
  payload: number;
  type: 'set search index position';
};

type SetSearchQuery = {
  payload: string;
  type: 'set search query';
};

type FlamegraphSearchAction =
  | ClearFlamegraphSearchAction
  | FlamegraphSearchArrowNavigationAction
  | SetFlamegraphResultsAction
  | SetSearchQuery;

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
    case 'set search query': {
      return {
        ...state,
        query: action.payload,
      };
    }
    case 'set results': {
      return {...state, results: action.payload};
    }
    case 'set search index position': {
      return {...state, index: action.payload};
    }
    default: {
      return state;
    }
  }
}
