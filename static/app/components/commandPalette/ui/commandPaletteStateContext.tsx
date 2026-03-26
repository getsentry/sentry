import {createContext, useContext, useReducer, useRef} from 'react';

import {
  openCommandPaletteDeprecated,
  toggleCommandPalette,
} from 'sentry/actionCreators/modal';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {unreachable} from 'sentry/utils/unreachable';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useOrganization} from 'sentry/utils/useOrganization';

export type LinkedList = {
  previous: LinkedList | null;
  value: {action: CommandPaletteActionWithKey; query: string};
};

export type CommandPaletteState = {
  action: LinkedList | null;
  input: React.RefObject<HTMLInputElement | null>;
  open: boolean;
  query: string;
};

export type CommandPaletteDispatch = React.Dispatch<CommandPaletteAction>;

export type CommandPaletteAction =
  | {type: 'toggle modal'}
  | {type: 'reset'}
  | {query: string; type: 'set query'}
  | {action: CommandPaletteActionWithKey; type: 'push action'}
  | {type: 'trigger action'}
  | {type: 'pop action'};

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
      return {
        ...state,
        open: !state.open,
      };
    case 'reset':
      return {
        ...state,
        action: null,
        query: '',
      };
    case 'set query':
      return {...state, query: action.query};
    case 'push action':
      return {
        ...state,
        action: {
          value: {action: action.action, query: state.query},
          previous: state.action,
        },
        query: '',
      };
    case 'pop action':
      return {
        ...state,
        action: state.action?.previous ?? null,
        query: state.action?.value?.query ?? state.query,
      };
    case 'trigger action':
      return {...state, action: null, query: ''};
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

  useHotkeys([
    {
      match: ['command+shift+p', 'command+k', 'ctrl+shift+p', 'ctrl+k'],
      includeInputs: true,
      callback: () => {
        if (organization?.features.includes('cmd-k-supercharged')) {
          toggleCommandPalette({}, organization, state, dispatch, 'keyboard');
        } else {
          openCommandPaletteDeprecated();
        }
      },
    },
  ]);

  return null;
}

export function getActionPath(state: CommandPaletteState): string {
  const path: string[] = [];
  let node = state.action;
  while (node !== null) {
    const label =
      typeof node.value.action.display.label === 'string'
        ? node.value.action.display.label
        : '';
    path.unshift(label);
    node = node.previous;
  }
  return path.join(' -> ');
}
