import {useEffect} from 'react';

import {useCommandPaletteRegistration} from './context';
import type {CommandPaletteAction} from './types';

/**
 * Registers actions with the command palette, and removes them on unmount.
 *
 * Actions will be shown in the order that they are registered. See the
 * CommandPaletteAction type for available configuration options.
 */
export function useCommandPaletteActions(actions: CommandPaletteAction[]) {
  const registerActions = useCommandPaletteRegistration();

  useEffect(() => registerActions(actions), [actions, registerActions]);
}
