import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {SpanChartNode} from 'sentry/utils/profiling/spanChart';

type FlamegraphSearchResult = {
  frame: FlamegraphFrame;
  match: ReadonlyArray<[number, number]>;
};

type SpansSearchResult = {match: ReadonlyArray<[number, number]>; span: SpanChartNode};

export type FlamegraphSearch = {
  highlightFrames: {name: string | undefined; package: string | undefined} | null;
  index: number | null;
  query: string;
  results: {
    frames: Map<string, FlamegraphSearchResult>;
    spans: Map<string, SpansSearchResult>;
  };
};

type ClearFlamegraphSearchAction = {type: 'clear search'};

type SetFlamegraphResultsAction = {
  payload: {query: string; results: FlamegraphSearch['results']};
  type: 'set search results';
};

type FlamegraphSearchArrowNavigationAction =
  | {type: 'next search result'}
  | {type: 'previous search result'}
  | {payload: number; type: 'set search index position'};

type SetHighlightAllFrames = {
  payload: {name: string; package: string} | null;
  type: 'set highlight all frames';
};

type FlamegraphSearchAction =
  | ClearFlamegraphSearchAction
  | FlamegraphSearchArrowNavigationAction
  | SetFlamegraphResultsAction
  | SetHighlightAllFrames;

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
        highlightFrames: null,
        results: {frames: new Map(), spans: new Map()},
      };
    }
    case 'set highlight all frames': {
      return {...state, highlightFrames: action.payload};
    }
    case 'set search results': {
      const frames = action.payload.results.frames;
      const spans = action.payload.results.spans;
      const index = frames.size + spans.size > 0 ? 0 : null;
      return {...state, index, highlightFrames: null, ...action.payload};
    }
    case 'next search result': {
      const resultCount = state.results.frames.size + state.results.spans.size;
      if (resultCount === 0) {
        return state;
      }

      const index = state.index === null ? 0 : (state.index + 1) % resultCount;
      return {...state, index};
    }
    case 'previous search result': {
      const resultCount = state.results.frames.size + state.results.spans.size;
      if (resultCount === 0) {
        return state;
      }

      const index =
        state.index === null
          ? resultCount - 1
          : (state.index - 1 + resultCount) % resultCount;
      return {...state, index};
    }
    case 'set search index position': {
      return {...state, index: action.payload};
    }
    default: {
      return state;
    }
  }
}
