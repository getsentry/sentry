import {useEffect, useMemo, useRef} from 'react';

import {useShortcuts} from 'sentry/utils/keyboardShortcuts/shortcutsProvider';
import type {Shortcut} from 'sentry/utils/keyboardShortcuts/types';

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

  const stableShortcuts = useMemo(
    () =>
      shortcutsRef.current.map(shortcut => ({
        ...shortcut,
        handler: (e: KeyboardEvent) => {
          // Find the current handler from the ref
          const currentShortcut = shortcutsRef.current.find(s => s.id === shortcut.id);
          if (currentShortcut) {
            currentShortcut.handler(e);
          }
        },
      })),
    []
  );

  useEffect(() => {
    // Create stable shortcuts with handlers that use the ref

    // Register shortcuts for this component context
    registerContext(context, stableShortcuts);

    // Cleanup on unmount
    return () => {
      unregisterContext(context);
    };
    // Only re-register when context or shortcut structure changes
  }, [context, stableShortcuts, registerContext, unregisterContext]);
}
