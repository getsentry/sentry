import {createContext, useContext, useReducer} from 'react';

import {
  openCommandPaletteDeprecated,
  toggleCommandPalette,
} from 'sentry/actionCreators/modal';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {unreachable} from 'sentry/utils/unreachable';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useOrganization} from 'sentry/utils/useOrganization';

export type CommandPaletteState = {
  open: boolean;
  query: string;
  selectedAction: CommandPaletteActionWithKey | null;
};

export type CommandPaletteDispatch = React.Dispatch<CommandPaletteAction>;

export type CommandPaletteAction =
  | {type: 'toggle modal'}
  | {query: string; type: 'set query'}
  | {action: CommandPaletteActionWithKey; type: 'set selected action'}
  | {type: 'trigger action'}
  | {type: 'clear selected action'};

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
    case 'set query':
      return {...state, query: action.query};
    case 'set selected action':
      return {...state, selectedAction: action.action, query: ''};
    case 'clear selected action':
      return {...state, selectedAction: null};
    case 'trigger action':
      return {...state, selectedAction: null, query: ''};
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
  const [state, dispatch] = useReducer(commandPaletteReducer, {
    query: '',
    selectedAction: null,
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

export function CommandPaletteHotkeys() {
  const state = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();
  const organization = useOrganization();

  useHotkeys([
    {
      match: ['command+shift+p', 'command+k', 'ctrl+shift+p', 'ctrl+k'],
      includeInputs: true,
      callback: () => {
        if (organization.features.includes('cmd-k-supercharged')) {
          toggleCommandPalette({}, organization, state, dispatch, 'keyboard');
        } else {
          openCommandPaletteDeprecated();
        }
      },
    },
  ]);

  return null;
}
