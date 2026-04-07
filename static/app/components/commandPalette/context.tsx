import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import {uuid4} from '@sentry/core';

import {slugify} from 'sentry/utils/slugify';
import {unreachable} from 'sentry/utils/unreachable';

import {CommandPaletteStateProvider} from './ui/commandPaletteStateContext';
import type {CommandPaletteAction, CommandPaletteActionWithKey} from './types';

function addKeysToActions(
  actions: CommandPaletteAction[]
): CommandPaletteActionWithKey[] {
  return actions.map(action => {
    const kind = 'actions' in action ? 'group' : 'to' in action ? 'navigate' : 'callback';
    const actionKey = `${kind}:${slugify(action.display.label)}:${uuid4()}`;

    if ('actions' in action) {
      return {
        ...action,
        actions: addKeysToChildActions(actionKey, action.actions),
        key: actionKey,
      };
    }

    return {
      ...action,
      key: actionKey,
    };
  });
}

function addKeysToChildActions(
  parentKey: string,
  actions: CommandPaletteAction[]
): CommandPaletteActionWithKey[] {
  return actions.map(action => {
    const actionKey = `${parentKey}::${'actions' in action ? 'group' : 'to' in action ? 'navigate' : 'callback'}:${slugify(action.display.label)}`;

    if ('actions' in action) {
      return {
        ...action,
        actions: addKeysToChildActions(actionKey, action.actions),
        key: actionKey,
      };
    }

    return {
      ...action,
      key: actionKey,
    };
  });
}

type CommandPaletteProviderProps = {children: React.ReactNode};
type CommandPaletteActions = CommandPaletteActionWithKey[];

type Unregister = () => void;
type CommandPaletteRegistration = {
  dispatch: React.Dispatch<CommandPaletteActionReducerAction>;
  registerActions: (actions: CommandPaletteAction[]) => Unregister;
};

type CommandPaletteActionReducerAction =
  | {
      actions: CommandPaletteActionWithKey[];
      type: 'register';
    }
  | {
      keys: string[];
      type: 'unregister';
    };

const CommandPaletteRegistrationContext =
  createContext<CommandPaletteRegistration | null>(null);
const CommandPaletteActionsContext = createContext<CommandPaletteActions | null>(null);

function useCommandPaletteRegistration(): CommandPaletteRegistration {
  const ctx = useContext(CommandPaletteRegistrationContext);
  if (ctx === null) {
    throw new Error(
      'useCommandPaletteRegistration must be wrapped in CommandPaletteProvider'
    );
  }
  return ctx;
}

export function useCommandPaletteActions(): CommandPaletteActionWithKey[] {
  const ctx = useContext(CommandPaletteActionsContext);
  if (ctx === null) {
    throw new Error('useCommandPaletteActions must be wrapped in CommandPaletteProvider');
  }
  return ctx;
}

function actionsReducer(
  state: CommandPaletteActionWithKey[],
  reducerAction: CommandPaletteActionReducerAction
): CommandPaletteActionWithKey[] {
  const type = reducerAction.type;
  switch (type) {
    case 'register': {
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
    case 'unregister':
      // @TODO(Jonas): this needs to support deep unregistering of actions
      return state.filter(action => !reducerAction.keys.includes(action.key));
    default:
      unreachable(type);
      return state;
  }
}

export function CommandPaletteProvider({children}: CommandPaletteProviderProps) {
  const [actions, dispatch] = useReducer(actionsReducer, []);

  const registerActions = useCallback(
    (newActions: CommandPaletteAction[]) => {
      const actionsWithKeys = addKeysToActions(newActions);

      dispatch({type: 'register', actions: actionsWithKeys});
      return () => {
        dispatch({type: 'unregister', keys: actionsWithKeys.map(a => a.key)});
      };
    },
    [dispatch]
  );

  const registerContext = useMemo(
    () => ({registerActions, dispatch}),
    [registerActions, dispatch]
  );
  return (
    <CommandPaletteRegistrationContext.Provider value={registerContext}>
      <CommandPaletteActionsContext.Provider value={actions}>
        <CommandPaletteStateProvider>{children}</CommandPaletteStateProvider>
      </CommandPaletteActionsContext.Provider>
    </CommandPaletteRegistrationContext.Provider>
  );
}

/**
 * Use this hook inside your page or feature component to register contextual actions with the global command palette.
 * Actions are registered on mount and automatically unregistered on unmount, so they only appear in the palette while
 * your component is rendered. This is ideal for page‑specific shortcuts.
 *
 * There are a few different types of actions you can register:
 *
 * - **Navigation actions**: Provide a `to` destination to navigate to when selected.
 * - **Callback actions**: Provide an `onAction` handler to execute when selected.
 * - **Nested actions**: Provide an `actions: CommandPaletteAction[]` array on a parent item to show a second level. Selecting the parent reveals its children.
 *
 * See the CommandPaletteAction type for more details on configuration.
 */
export function useCommandPaletteActionsRegister(actions: CommandPaletteAction[]) {
  const {registerActions} = useCommandPaletteRegistration();

  useEffect(() => registerActions(actions), [actions, registerActions]);
}
