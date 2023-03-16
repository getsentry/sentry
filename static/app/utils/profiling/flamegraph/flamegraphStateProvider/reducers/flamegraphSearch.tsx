import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {SpanChartNode} from 'sentry/utils/profiling/spanChart';

export type FlamegraphSearchResult = {
  frame: FlamegraphFrame;
  match: ReadonlyArray<[number, number]>;
};

export type SpansSearchResult = {
  match: ReadonlyArray<[number, number]>;
  span: SpanChartNode;
};

export type FlamegraphSearch = {
  index: number | null;
  query: string;
  results: {
    frames: Map<string, FlamegraphSearchResult>;
    spans: Map<string, SpansSearchResult>;
  };
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
        results: {
          frames: new Map(),
          spans: new Map(),
        },
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
