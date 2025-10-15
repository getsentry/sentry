import {useEffect} from 'react';

import {useCommandPaletteConfiguration} from './context';
import type {CommandPaletteAction} from './types';

/**
 * Registers actions with the command palette, and removes them on unmount.
 *
 * Actions will be shown in the order that they are registered. See the
 * CommandPaletteAction type for available configuration options.
 */
export function useCommandPaletteActions(
  actions: CommandPaletteAction[] | null | undefined
) {
  const {registerActions, unregisterActions} = useCommandPaletteConfiguration();

  useEffect(() => {
    if (!actions || actions.length === 0) {
      return () => {};
    }
    registerActions(actions);
    return () => unregisterActions(actions.map(a => a.key));
  }, [registerActions, unregisterActions, actions]);
}
