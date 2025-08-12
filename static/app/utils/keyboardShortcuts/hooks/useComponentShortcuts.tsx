import {useEffect, useRef} from 'react';

import type {Shortcut} from '../types';
import {useShortcuts} from '../shortcutsProvider';

/**
 * Hook to register component-specific keyboard shortcuts
 *
 * @param context - Unique identifier for this component's shortcuts
 * @param shortcuts - Array of shortcuts to register
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useComponentShortcuts('my-component', [
 *     {
 *       id: 'save',
 *       key: 'cmd+s',
 *       description: 'Save changes',
 *       handler: () => handleSave(),
 *     }
 *   ]);
 * }
 * ```
 */
export function useComponentShortcuts(context: string, shortcuts: Shortcut[]) {
  const {registerContext, unregisterContext} = useShortcuts();
  const shortcutsRef = useRef(shortcuts);

  // Update ref to latest shortcuts
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    // Create stable shortcuts with handlers that use the ref
    const stableShortcuts = shortcuts.map(shortcut => ({
      ...shortcut,
      handler: (e: KeyboardEvent) => {
        // Find the current handler from the ref
        const currentShortcut = shortcutsRef.current.find(s => s.id === shortcut.id);
        if (currentShortcut) {
          currentShortcut.handler(e);
        }
      },
    }));

    // Register shortcuts for this component context
    registerContext(context, stableShortcuts);

    // Cleanup on unmount
    return () => {
      unregisterContext(context);
    };
    // Only re-register when context or shortcut structure changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context,
    shortcuts.map(s => s.id + s.key).join(','),
    registerContext,
    unregisterContext,
  ]);
}
