import {createContext, useContext, useEffect, useReducer, useRef} from 'react';

import {useGlobalHotkeys} from '@sentry/scraps/hotkey';

import {toggleCommandPalette} from 'sentry/actionCreators/modal';
import type {CMDKChainedActionAnchor} from 'sentry/components/commandPalette/ui/cmdkChainedActionScope';
import {OPEN_COMMAND_PALETTE_SHORTCUTS} from 'sentry/components/keyboardShortcuts/keyboardShortcuts';
import {unreachable} from 'sentry/utils/unreachable';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

/**
 * A stack entry for navigating into a CMDK group. Stores the group's
 * collection key and display label so the palette can render the correct
 * subtree and placeholder text without holding on to the full action object.
 */
export type CMDKNavStack = {
  previous: CMDKNavStack | null;
  value: {
    key: string;
    label: string;
    query: string;
    prompt?: string;
    // Result row to restore when this stack entry is popped.
    returnFocusKey?: string | number;
  };
};

export type CommandPaletteState = {
  action: CMDKNavStack | null;
  input: React.RefObject<HTMLInputElement | null>;
  // Controls whether the rendered action list updates from the collection store.
  // 'frozen' keeps the visible list stable while the user navigates with the
  // keyboard. Any other dispatched action resets to 'active'.
  list: 'active' | 'frozen';
  open: boolean;
  // When true, action and query are cleared the next time the modal opens.
  // Set by 'trigger action' so the close animation plays without a jarring
  // content swap, while still ensuring a clean slate on the next open.
  pendingReset: boolean;
  query: string;
  // When true, state is reset as part of the next open transition. Set when
  // the route changes while the palette is closed, so navigation always starts
  // from a clean slate.
  resetOnOpen: boolean;
};

export type CommandPaletteDispatch = React.Dispatch<CommandPaletteAction>;

type CommandPaletteAction =
  | {type: 'toggle modal'}
  | {type: 'reset'}
  | {query: string; type: 'set query'}
  | {
      key: string;
      label: string;
      type: 'push action';
      prompt?: string;
      query?: string;
      returnFocusKey?: string | number;
    }
  | {type: 'trigger action'}
  | {anchor: CMDKChainedActionAnchor; type: 'return to anchor'}
  | {type: 'pop action'}
  | {type: 'reset on open'}
  | {type: 'freeze list'};

const CommandPaletteStateContext = createContext<CommandPaletteState | null>(null);
const CommandPaletteDispatchContext =
  createContext<React.Dispatch<CommandPaletteAction> | null>(null);

function findActionInStack(stack: CMDKNavStack | null, key: string): CMDKNavStack | null {
  if (!stack || stack.value.key === key) {
    return stack;
  }
  return findActionInStack(stack.previous, key);
}

/**
 * Returns the existing workflow anchor when it is already in the navigation
 * path. Deferred action trees may register an anchor after navigation starts,
 * so reconstruct it under the nearest known parent when it is absent.
 */
function makeChainedActionAnchorStack(
  stack: CMDKNavStack | null,
  anchor: CMDKChainedActionAnchor
): CMDKNavStack {
  const existingAnchor = findActionInStack(stack, anchor.key);
  if (existingAnchor) {
    return existingAnchor;
  }

  return {
    previous: anchor.parentKey ? findActionInStack(stack, anchor.parentKey) : null,
    value: {
      key: anchor.key,
      label: anchor.label,
      prompt: anchor.prompt,
      query: '',
    },
  };
}

function commandPaletteReducer(
  state: CommandPaletteState,
  action: CommandPaletteAction
): CommandPaletteState {
  const type = action.type;
  switch (type) {
    case 'freeze list':
      return {...state, list: 'frozen'};
    case 'toggle modal':
      // Terminal actions keep their final view mounted during the close animation.
      // Clear that deferred state only when the palette is opened again.
      if (!state.open && (state.resetOnOpen || state.pendingReset)) {
        return {
          ...state,
          open: true,
          action: null,
          query: '',
          resetOnOpen: false,
          pendingReset: false,
          list: 'active',
        };
      }
      return {
        ...state,
        open: !state.open,
        list: 'active',
      };
    case 'reset':
      return {
        ...state,
        action: null,
        query: '',
        pendingReset: false,
        resetOnOpen: false,
        list: 'active',
      };
    case 'reset on open':
      return {...state, resetOnOpen: true, list: 'active'};
    case 'set query':
      return {...state, query: action.query, list: 'active'};
    case 'push action':
      return {
        ...state,
        action: {
          value: {
            key: action.key,
            label: action.label,
            prompt: action.prompt,
            // Preserve this level's search so Back restores the same view.
            query: state.query,
            returnFocusKey: action.returnFocusKey,
          },
          previous: state.action,
        },
        query: action.query ?? '',
        list: 'active',
      };
    case 'pop action':
      return {
        ...state,
        action: state.action?.previous ?? null,
        query: state.action?.value?.query ?? state.query,
        list: 'active',
      };
    case 'trigger action':
      return {...state, pendingReset: true, list: 'active'};
    case 'return to anchor':
      // Chained callbacks continue editing instead of consuming pendingReset and
      // closing like terminal actions.
      return {
        ...state,
        action: makeChainedActionAnchorStack(state.action, action.anchor),
        query: '',
        pendingReset: false,
        list: 'active',
      };
    default:
      unreachable(type);
      return state;
  }
}

export function useCommandPaletteState(): CommandPaletteState {
  const ctx = useContext(CommandPaletteStateContext);
  if (ctx === null) {
    throw new Error('useCommandPaletteState must be used within CommandPaletteProvider');
  }
  return ctx;
}

export function useCommandPaletteDispatch(): CommandPaletteDispatch {
  const ctx = useContext(CommandPaletteDispatchContext);
  if (ctx === null) {
    throw new Error(
      'useCommandPaletteDispatch must be used within CommandPaletteProvider'
    );
  }
  return ctx;
}

interface CommandPaletteStateProviderProps {
  children: React.ReactNode;
}

export function CommandPaletteStateProvider({
  children,
}: CommandPaletteStateProviderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(commandPaletteReducer, {
    input: inputRef,
    query: '',
    action: null,
    open: false,
    pendingReset: false,
    resetOnOpen: false,
    list: 'active',
  });

  return (
    <CommandPaletteDispatchContext.Provider value={dispatch}>
      <CommandPaletteStateContext.Provider value={state}>
        {children}
      </CommandPaletteStateContext.Provider>
    </CommandPaletteDispatchContext.Provider>
  );
}

/**
 * Traverses the linked list from oldest to newest and returns the labels of
 * all actions in the stack, suitable for building breadcrumb strings.
 */
export function CommandPaletteHotkeys() {
  const organization = useOrganization({allowNull: true});
  const state = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();
  const location = useLocation();
  const {openSeerExplorer} = useSeerExplorerContext();

  // When the route pathname changes, mark state for reset on the next open.
  // Skip the initial render — only react to actual route changes.
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    dispatch({type: 'reset on open'});
  }, [location.pathname, dispatch]);

  // Register during capture so focused widgets cannot swallow this app-level shortcut.
  useGlobalHotkeys([
    {
      match: [...OPEN_COMMAND_PALETTE_SHORTCUTS],
      includeInputs: true,
      callback: () => {
        if (!organization) {
          return;
        }
        toggleCommandPalette(
          {},
          organization,
          state,
          dispatch,
          'keyboard',
          isSeerExplorerEnabled(organization) ? openSeerExplorer : undefined
        );
      },
    },
  ]);

  return null;
}

export function getActionPath(state: CommandPaletteState): string {
  const path: string[] = [];
  let node = state.action;
  while (node !== null) {
    path.unshift(node.value.label);
    node = node.previous;
  }
  return path.join(' → ');
}
