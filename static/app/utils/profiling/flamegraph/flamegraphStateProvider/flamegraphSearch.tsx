import {FlamegraphFrame} from '../../flamegraphFrame';

type FlamegraphSearch = {
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
    results: FlamegraphSearch['results'];
  };
  type: 'set results';
};

type FlamegraphSearchArrowNavigationAction = {
  payload: number;
  type: 'set search index position';
};

type FlamegraphSearchAction =
  | OpenFlamegraphSearchAction
  | CloseFlamegraphSearchAction
  | ClearFlamegraphSearchAction
  | FlamegraphSearchArrowNavigationAction
  | SetFlamegraphResultsAction;

export function flamegraphSearchReducer(
  state: FlamegraphSearch,
  action: FlamegraphSearchAction
): FlamegraphSearch {
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
