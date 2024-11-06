import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import {traceReducerExhaustiveActionCheck} from '../traceState';

export interface TraceRovingTabIndexState {
  index: number | null;
  items: number | null;
  node: TraceTreeNode<TraceTree.NodeValue> | null;
}

export type TraceRovingTabIndexAction =
  | {
      index: number | null;
      items: number;
      node: TraceTreeNode<TraceTree.NodeValue> | null;
      type: 'initialize roving reducer';
    }
  | {
      action_source: 'click' | 'keyboard' | 'load';
      index: number;
      node: TraceTreeNode<TraceTree.NodeValue>;
      type: 'set roving index';
    }
  | {type: 'clear roving index'}
  | {items: number; type: 'set roving count'};

export type RovingTabIndexUserActions = 'next' | 'previous' | 'last' | 'first';

export function traceRovingTabIndexReducer(
  state: TraceRovingTabIndexState,
  action: TraceRovingTabIndexAction
): TraceRovingTabIndexState {
  switch (action.type) {
    case 'initialize roving reducer': {
      return {index: action.index, items: action.items, node: action.node};
    }
    case 'set roving count': {
      return {...state, items: action.items};
    }
    case 'set roving index':
      return {...state, node: action.node, index: action.index};
    case 'clear roving index':
      return {...state, index: null, node: null};
    default:
      traceReducerExhaustiveActionCheck(action);
      return state;
  }
}

export function getRovingIndexActionFromDOMEvent(
  event: React.KeyboardEvent
): RovingTabIndexUserActions | null {
  // @TODO it would be trivial to extend this and support
  // things like j/k vim-like navigation or add modifiers
  // so that users could jump to parent or sibling nodes.
  // I would need to put some thought into this, but shift+cmd+up
  // seems like a good candidate for jumping to parent node and
  // shift+cmd+down for jumping to the next sibling node.
  switch (event.key) {
    case 'ArrowDown':
      if (event.shiftKey) {
        return 'last';
      }
      return 'next';
    case 'ArrowUp':
      if (event.shiftKey) {
        return 'first';
      }
      return 'previous';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'Tab':
      if (event.shiftKey) {
        return 'previous';
      }
      return 'next';

    default:
      return null;
  }
}
