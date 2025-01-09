import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import type {TraceSearchResult} from '../traceSearch/traceSearchEvaluator';
import {traceReducerExhaustiveActionCheck} from '../traceState';

export type TraceSearchAction =
  | {query: string; type: 'set query'; source?: 'external'}
  | {type: 'go to first match'}
  | {type: 'go to last match'}
  | {type: 'go to next match'}
  | {type: 'go to previous match'}
  | {
      resultIndex: number;
      resultIteratorIndex: number;
      type: 'set search iterator index';
    }
  | {type: 'clear search iterator index'}
  | {type: 'clear query'}
  | {
      node: TraceTreeNode<TraceTree.NodeValue> | null;
      previousNode: {
        resultIndex: number | undefined;
        resultIteratorIndex: number | undefined;
      } | null;
      results: ReadonlyArray<TraceSearchResult>;
      resultsLookup: Map<TraceTreeNode<TraceTree.NodeValue>, number>;
      type: 'set results';
      resultIndex?: number;
      resultIteratorIndex?: number;
    };

export type TraceSearchState = {
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  query: string | undefined;
  // Index in the list/tree
  resultIndex: number | null;
  // Index in the results array
  resultIteratorIndex: number | null;
  results: ReadonlyArray<TraceSearchResult> | null;
  resultsLookup: Map<TraceTreeNode<TraceTree.NodeValue>, number>;
  status: [ts: number, 'loading' | 'success' | 'error'] | undefined;
};

function assertBoundedIndex(index: number, length: number) {
  if (index < 0 || index > length - 1) {
    throw new Error('Search index out of bounds');
  }
}

export function traceSearchReducer(
  state: TraceSearchState,
  action: TraceSearchAction
): TraceSearchState {
  switch (action.type) {
    case 'clear query': {
      return {
        node: null,
        query: undefined,
        resultIteratorIndex: null,
        results: null,
        resultIndex: null,
        resultsLookup: new Map(),
        status: undefined,
      };
    }
    case 'go to first match': {
      if (!state.results || state.results.length === 0) {
        return state;
      }
      return {
        ...state,
        node: state.results[0]!.value,
        resultIteratorIndex: 0,
        resultIndex: state.results[0]!.index,
      };
    }
    case 'go to last match': {
      if (!state.results || state.results.length === 0) {
        return state;
      }
      return {
        ...state,
        resultIteratorIndex: state.results.length - 1,
        resultIndex: state.results[state.results.length - 1]!.index,
        node: state.results[state.results.length - 1]!.value,
      };
    }
    case 'go to next match': {
      if (state.resultIteratorIndex === null) {
        if (!state.results || state.results.length === 0) {
          return state;
        }
        return {
          ...state,
          resultIteratorIndex: 0,
          resultIndex: state.results[0]!.index,
          node: state.results[0]!.value,
        };
      }
      if (!state.results) {
        return state;
      }

      let next = state.resultIteratorIndex + 1;
      if (next > state.results.length - 1) {
        next = 0;
      }

      assertBoundedIndex(next, state.results.length);
      return {
        ...state,
        resultIteratorIndex: next,
        resultIndex: state.results[next]!.index,
        node: state.results[next]!.value,
      };
    }
    case 'go to previous match': {
      if (state.resultIteratorIndex === null) {
        if (!state.results || !state.results.length) {
          return state;
        }
        return {
          ...state,
          resultIteratorIndex: state.results.length - 1,
          resultIndex: state.results[state.results.length - 1]!.index,
          node: state.results[state.results.length - 1]!.value,
        };
      }
      if (!state.results) {
        return state;
      }

      let previous = state.resultIteratorIndex - 1;
      if (previous < 0) {
        previous = state.results.length - 1;
      }

      assertBoundedIndex(previous, state.results.length);
      return {
        ...state,
        resultIteratorIndex: previous,
        resultIndex: state.results[previous]!.index,
        node: state.results[previous]!.value,
      };
    }
    case 'set results': {
      return {
        ...state,
        status: [performance.now(), 'success'],
        results: action.results,
        resultIteratorIndex: action.resultIteratorIndex ?? null,
        node: action.node ?? null,
        resultIndex: action.resultIndex ?? null,
        resultsLookup: action.resultsLookup,
      };
    }
    case 'set query': {
      return {
        ...state,
        status: [performance.now(), 'loading'],
        query: action.query,
      };
    }

    case 'set search iterator index': {
      return {
        ...state,
        node: state.results?.[action.resultIteratorIndex]?.value ?? null,
        resultIteratorIndex: action.resultIteratorIndex,
        resultIndex: action.resultIndex,
      };
    }

    case 'clear search iterator index':
      return {
        ...state,
        resultIteratorIndex: null,
        resultIndex: null,
        node: null,
      };

    default: {
      traceReducerExhaustiveActionCheck(action);
      return state;
    }
  }
}
