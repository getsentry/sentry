import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';

import type {CommandPaletteAction} from './types';

type CommandPaletteProviderProps = {children: React.ReactNode};

type CommandPaletteStore = {
  actionsRef: React.RefObject<CommandPaletteAction[]>;
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
  // We store the actions in a ref to prevent re-rendering when actions are registered.
  // This means that actions registered while the palette is open will not be displayed,
  // but this is something that we probably don't need to support.
  const actionsRef = useRef<CommandPaletteAction[]>([]);

  const registerActions = useCallback((newActions: CommandPaletteAction[]) => {
    for (const newAction of newActions) {
      const existingIndex = actionsRef.current.findIndex(
        action => action.key === newAction.key
      );

      if (existingIndex >= 0) {
        actionsRef.current[existingIndex] = newAction;
      } else {
        actionsRef.current.push(newAction);
      }
    }

    return actionsRef.current;
  }, []);

  const unregisterActions = useCallback((keys: string[]) => {
    actionsRef.current = actionsRef.current.filter(action => !keys.includes(action.key));
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
      actionsRef,
    }),
    []
  );

  return (
    <CommandPaletteConfigContext.Provider value={config}>
      <CommandPaletteStoreContext.Provider value={store}>
        {children}
      </CommandPaletteStoreContext.Provider>
    </CommandPaletteConfigContext.Provider>
  );
}
