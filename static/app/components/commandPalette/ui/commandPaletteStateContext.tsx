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
  modal: {
    open: boolean;
    restoreFocusToElement: Element | null;
  };
  query: string;
  selectedAction: CommandPaletteActionWithKey | null;
};

export type CommandPaletteDispatch = React.Dispatch<CommandPaletteAction>;

export type CommandPaletteAction =
  | {restoreFocusToElement: Element | null; type: 'open modal'}
  | {type: 'close modal'}
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
    case 'open modal':
      return {
        ...state,
        modal: {open: true, restoreFocusToElement: action.restoreFocusToElement},
      };
    case 'close modal':
      return {...state, modal: {open: false, restoreFocusToElement: null}};
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

    modal: {
      open: false,
      restoreFocusToElement: null,
    },
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
          toggleCommandPalette({}, state, dispatch);
        } else {
          openCommandPaletteDeprecated();
        }
      },
    },
  ]);

  return null;
}
