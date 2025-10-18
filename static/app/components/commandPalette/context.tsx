import {createContext, useCallback, useContext, useMemo, useReducer} from 'react';

import type {CommandPaletteAction} from './types';

type CommandPaletteProviderProps = {children: React.ReactNode};

type CommandPaletteStore = {
  actions: CommandPaletteAction[];
};

type CommandPaletteConfig = {
  registerActions: (actions: CommandPaletteAction[]) => void;
  unregisterActions: (keys: string[]) => void;
};

type CommandPaletteActionReducerAction =
  | {
      actions: CommandPaletteAction[];
      type: 'REGISTER_ACTIONS';
    }
  | {
      keys: string[];
      type: 'UNREGISTER_ACTIONS';
    };

const CommandPaletteConfigContext = createContext<CommandPaletteConfig | null>(null);
const CommandPaletteStoreContext = createContext<CommandPaletteStore | null>(null);

export function useCommandPaletteConfiguration(): CommandPaletteConfig {
  const ctx = useContext(CommandPaletteConfigContext);
  if (ctx === null) {
    throw new Error('Must be wrapped in CommandPaletteProvider');
  }
  return ctx;
}

export function useCommandPaletteStore(): CommandPaletteStore {
  const ctx = useContext(CommandPaletteStoreContext);
  if (ctx === null) {
    throw new Error('Must be wrapped in CommandPaletteProvider');
  }
  return ctx;
}

function actionsReducer(
  state: CommandPaletteAction[],
  reducerAction: CommandPaletteActionReducerAction
): CommandPaletteAction[] {
  switch (reducerAction.type) {
    case 'REGISTER_ACTIONS': {
      const result = [...state];

      for (const newAction of reducerAction.actions) {
        const existingIndex = result.findIndex(action => action.key === newAction.key);

        if (existingIndex >= 0) {
          result[existingIndex] = newAction;
        } else {
          result.push(newAction);
        }
      }

      return result;
    }
    case 'UNREGISTER_ACTIONS':
      return state.filter(action => !reducerAction.keys.includes(action.key));
    default:
      return state;
  }
}

export function CommandPaletteProvider({children}: CommandPaletteProviderProps) {
  const [actions, dispatch] = useReducer(actionsReducer, []);

  const registerActions = useCallback((newActions: CommandPaletteAction[]) => {
    dispatch({type: 'REGISTER_ACTIONS', actions: newActions});
  }, []);
  const unregisterActions = useCallback((keys: string[]) => {
    dispatch({type: 'UNREGISTER_ACTIONS', keys});
  }, []);

  const config = useMemo<CommandPaletteConfig>(
    () => ({
      registerActions,
      unregisterActions,
    }),
    [registerActions, unregisterActions]
  );

  const store = useMemo<CommandPaletteStore>(
    () => ({
      actions,
    }),
    [actions]
  );

  return (
    <CommandPaletteConfigContext.Provider value={config}>
      <CommandPaletteStoreContext.Provider value={store}>
        {children}
      </CommandPaletteStoreContext.Provider>
    </CommandPaletteConfigContext.Provider>
  );
}
