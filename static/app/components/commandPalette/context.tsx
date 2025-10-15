import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import type {CommandPaletteAction} from './types';

type CommandPaletteProviderProps = {children: React.ReactNode};

type CommandPaletteStore = {
  actions: CommandPaletteAction[];
};

type CommandPaletteConfig = {
  registerActions: (actions: CommandPaletteAction[]) => void;
  unregisterActions: (keys: string[]) => void;
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

export function CommandPaletteProvider({children}: CommandPaletteProviderProps) {
  const [actions, setActions] = useState<CommandPaletteAction[]>([]);

  const registerActions = useCallback((newActions: CommandPaletteAction[]) => {
    setActions(prev => {
      const result = [...prev];

      for (const newAction of newActions) {
        const existingIndex = result.findIndex(action => action.key === newAction.key);

        if (existingIndex >= 0) {
          result[existingIndex] = newAction;
        } else {
          result.push(newAction);
        }
      }

      return result;
    });
  }, []);

  const unregisterActions = useCallback((keys: string[]) => {
    setActions(prev => {
      return prev.filter(action => !keys.includes(action.key));
    });
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
