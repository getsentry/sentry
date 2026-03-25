import {createContext, useContext, useReducer} from 'react';

import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {unreachable} from 'sentry/utils/unreachable';

export type CommandPaletteState = {
  query: string;
  selectedAction: CommandPaletteActionWithKey | null;
};

export type CommandPaletteAction =
  | {query: string; type: 'set_query'}
  | {action: CommandPaletteActionWithKey; type: 'select_action'}
  | {type: 'clear_selection'};

const CommandPaletteStateContext = createContext<CommandPaletteState | null>(null);
const CommandPaletteDispatchContext =
  createContext<React.Dispatch<CommandPaletteAction> | null>(null);

function commandPaletteReducer(
  state: CommandPaletteState,
  action: CommandPaletteAction
): CommandPaletteState {
  const type = action.type;
  switch (type) {
    case 'set_query':
      return {...state, query: action.query};
    case 'select_action':
      return {...state, selectedAction: action.action};
    case 'clear_selection':
      return {...state, selectedAction: null};
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
