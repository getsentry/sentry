import {useEffect} from 'react';

import {useCommandPaletteConfiguration} from './context';
import type {CommandPaletteAction} from './types';

/**
 * Registers actions with the command palette, and removes them on unmount.
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
