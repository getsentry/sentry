import {useEffect, useId} from 'react';

import slugify from 'sentry/utils/slugify';

import {useCommandPaletteRegistration} from './context';
import type {
  CommandPaletteAction,
  CommandPaletteActionCallback,
  CommandPaletteActionCallbackWithKey,
  CommandPaletteActionLink,
  CommandPaletteActionLinkWithKey,
  CommandPaletteActionWithKey,
} from './types';

function addKeysToActions(
  id: string,
  actions: CommandPaletteAction[]
): CommandPaletteActionWithKey[] {
  return actions.map(action => {
    const actionKey = `${id}:${action.type}:${slugify(action.display.label)}`;

    if (action.type === 'group') {
      return {
        ...action,
        actions: addKeysToChildActions(id, action.actions),
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
  id: string,
  actions: Array<CommandPaletteActionLink | CommandPaletteActionCallback>
): Array<CommandPaletteActionLinkWithKey | CommandPaletteActionCallbackWithKey> {
  return actions.map(action => {
    const actionKey = `${id}:${action.type}:${action.display.label
      .toLowerCase()
      .replace(/ /g, '-')}`;
    return {
      ...action,
      key: actionKey,
    };
  });
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
export function useCommandPaletteActions(actions: CommandPaletteAction[]) {
  const id = useId();
  const registerActions = useCommandPaletteRegistration();

  useEffect(
    () => registerActions(addKeysToActions(id, actions)),
    [actions, id, registerActions]
  );
}
