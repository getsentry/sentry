import {createContext, useContext, useEffect, useReducer, useRef} from 'react';

import {useHotkeys} from '@sentry/scraps/hotkey';

import {toggleCommandPalette} from 'sentry/actionCreators/modal';
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
  value: {key: string; label: string; query: string; prompt?: string};
};

export type CommandPaletteState = {
  action: CMDKNavStack | null;
  input: React.RefObject<HTMLInputElement | null>;
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
    }
  | {type: 'trigger action'}
  | {type: 'pop action'}
  | {type: 'reset on open'};

const CommandPaletteStateContext = createContext<CommandPaletteState | null>(null);
const CommandPaletteDispatchContext =
  createContext<React.Dispatch<CommandPaletteAction> | null>(null);

function commandPaletteReducer(
  state: CommandPaletteState,
  action: CommandPaletteAction
): CommandPaletteState {
  const type = action.type;
  switch (type) {
    case 'toggle modal':
      if (!state.open && state.resetOnOpen) {
        return {
          ...state,
          open: true,
          action: null,
          query: '',
          resetOnOpen: false,
          pendingReset: false,
        };
      }
      return {
        ...state,
        open: !state.open,
      };
    case 'reset':
      return {
        ...state,
        action: null,
        query: '',
        pendingReset: false,
        resetOnOpen: false,
      };
    case 'reset on open':
      return {...state, resetOnOpen: true};
    case 'set query':
      return {...state, query: action.query};
    case 'push action':
      return {
        ...state,
        action: {
          value: {
            key: action.key,
            label: action.label,
            prompt: action.prompt,
            query: state.query,
          },
          previous: state.action,
        },
        query: action.query ?? '',
      };
    case 'pop action':
      return {
        ...state,
        action: state.action?.previous ?? null,
        query: state.action?.value?.query ?? state.query,
      };
    case 'trigger action':
      return {...state, pendingReset: true};
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

  useHotkeys([
    {
      match: ['mod+shift+p', 'mod+k'],
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
