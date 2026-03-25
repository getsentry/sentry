import {createContext, useContext, useReducer} from 'react';

import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {unreachable} from 'sentry/utils/unreachable';

export type CommandPaletteState = {
  query: string;
  selectedAction: CommandPaletteActionWithKey | null;
};

export type CommandPaletteAction =
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

export function useCommandPaletteDispatch(): React.Dispatch<CommandPaletteAction> {
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
  });

  return (
    <CommandPaletteDispatchContext.Provider value={dispatch}>
      <CommandPaletteStateContext.Provider value={state}>
        {children}
      </CommandPaletteStateContext.Provider>
    </CommandPaletteDispatchContext.Provider>
  );
}
