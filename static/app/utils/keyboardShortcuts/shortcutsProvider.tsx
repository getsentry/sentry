import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {css} from '@emotion/react';

import {openModal} from 'sentry/actionCreators/modal';
import {useHotkeys} from 'sentry/utils/useHotkeys';

import {ShortcutsHelpModal} from './components/shortcutsHelpModal';
import {shortcutRegistry} from './registry';
import {
  getSequenceInitializerKeysFromShortcuts,
  SEQUENCE_INITIALIZER_KEYS,
  validateSequenceInitializerConflicts,
} from './sequenceInitializers';
import type {Shortcut, ShortcutsContextValue} from './types';

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

interface ShortcutsProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that manages keyboard shortcuts for the entire application
 */
export function ShortcutsProvider({children}: ShortcutsProviderProps) {
  const [activeShortcuts, setActiveShortcuts] = useState<Shortcut[]>(() => {
    // Load any initial shortcuts from the registry
    return shortcutRegistry.getShortcuts();
  });
  const [sequenceKeysState, setSequenceKeys] = useState<string[]>([]);
  const sequenceTimeoutRef = useRef<number | null>(null);

  // Handle sequential key combinations (e.g., "g" then "i")
  const handleSequenceKey = useCallback((key: string) => {
    setSequenceKeys(prev => [...prev, key]);

    // Clear existing timeout
    if (sequenceTimeoutRef.current) {
      window.clearTimeout(sequenceTimeoutRef.current);
    }

    // Set new timeout to clear sequence after 1 second
    sequenceTimeoutRef.current = window.setTimeout(() => {
      setSequenceKeys([]);
    }, 1000);
  }, []);

  const registerContext = useCallback((context: string, shortcuts: Shortcut[]) => {
    shortcutRegistry.registerContext(context, shortcuts);
    const allShortcuts = shortcutRegistry.getShortcuts();

    // Use functional update to prevent dependencies on activeShortcuts
    setActiveShortcuts(prevShortcuts => {
      // Only update if the shortcuts actually changed
      if (JSON.stringify(prevShortcuts) === JSON.stringify(allShortcuts)) {
        return prevShortcuts;
      }
      return allShortcuts;
    });
  }, []);

  const unregisterContext = useCallback((context: string) => {
    shortcutRegistry.unregisterContext(context);
    setActiveShortcuts(shortcutRegistry.getShortcuts());
  }, []);

  const openHelpModal = useCallback(() => {
    // Get the current shortcuts from the registry instead of using stale state
    const currentShortcuts = shortcutRegistry.getShortcuts();
    openModal(
      modalProps => (
        <ShortcutsHelpModal
          {...modalProps}
          activeShortcuts={currentShortcuts}
          registry={shortcutRegistry}
        />
      ),
      {
        modalCss: css`
          width: auto;
        `,
      }
    );
  }, []);

  // Track which keys are part of sequences
  const sequenceKeys = useMemo(() => {
    const seqKeys = new Set<string>();
    activeShortcuts.forEach(shortcut => {
      const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
      keys.forEach(key => {
        const keyParts = key.split(' ');
        if (keyParts.length > 1) {
          keyParts.forEach(part => seqKeys.add(part));
        }
      });
    });
    return seqKeys;
  }, [activeShortcuts]);

  // Convert our shortcuts to the format expected by useHotkeys
  const hotkeyConfig = useMemo(() => {
    // Validate sequence initializer conflicts in development
    if (process.env.NODE_ENV === 'development') {
      try {
        validateSequenceInitializerConflicts(activeShortcuts);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('❌ Keyboard shortcut validation failed:', error);
        // Don't throw in production to avoid breaking the app
      }
    }

    const hotkeys: Parameters<typeof useHotkeys>[0] = [];
    const processedKeys = new Set<string>();
    const detectedSequenceInitializers =
      getSequenceInitializerKeysFromShortcuts(activeShortcuts);
    const allSequenceInitializers = new Set([
      ...SEQUENCE_INITIALIZER_KEYS,
      ...detectedSequenceInitializers,
    ]);

    // First, prioritize ALL sequence initializer keys - these should NEVER be single key shortcuts
    allSequenceInitializers.forEach(key => {
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        hotkeys.push({
          match: key,
          includeInputs: false,
          skipPreventDefault: false,
          callback: (e: KeyboardEvent) => {
            // If we already have a sequence started, check for completion
            if (sequenceKeysState.length > 0) {
              const potentialSequence = [...sequenceKeysState, key].join(' ');
              const matchingShortcut =
                shortcutRegistry.getShortcutForKey(potentialSequence);

              if (matchingShortcut && matchingShortcut.enabled !== false) {
                e.preventDefault();
                matchingShortcut.handler(e);
                setSequenceKeys([]);
                if (sequenceTimeoutRef.current) {
                  window.clearTimeout(sequenceTimeoutRef.current);
                }
                return;
              }
            }

            // Start or continue sequence
            handleSequenceKey(key);
          },
        });
      }
    });

    // Then, handle all other keys with sequence-aware logic
    activeShortcuts.forEach(shortcut => {
      if (!shortcut.enabled) return;

      const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];

      keys.forEach(key => {
        const keyParts = key.split(' ');

        if (
          keyParts.length === 1 &&
          !processedKeys.has(key) &&
          !allSequenceInitializers.has(key)
        ) {
          // Single key shortcut - but needs to be sequence-aware
          processedKeys.add(key);
          hotkeys.push({
            match: key,
            includeInputs: shortcut.allowInInputs,
            skipPreventDefault: !shortcut.preventDefault,
            callback: (e: KeyboardEvent) => {
              // FIRST: Check if we're completing a sequence
              if (sequenceKeysState.length > 0) {
                const potentialSequence = [...sequenceKeysState, key].join(' ');
                const matchingShortcut =
                  shortcutRegistry.getShortcutForKey(potentialSequence);

                if (matchingShortcut && matchingShortcut.enabled !== false) {
                  e.preventDefault();
                  matchingShortcut.handler(e);
                  setSequenceKeys([]);
                  if (sequenceTimeoutRef.current) {
                    window.clearTimeout(sequenceTimeoutRef.current);
                  }
                  return;
                }
              }

              // SECOND: Handle as single key shortcut
              shortcut.handler(e);
            },
          });
        }
      });
    });

    // Finally, handle remaining sequence keys (those not covered by single shortcuts)
    sequenceKeys.forEach(key => {
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        hotkeys.push({
          match: key,
          includeInputs: false,
          skipPreventDefault: false,
          callback: (e: KeyboardEvent) => {
            // If we already have a sequence started, check for completion
            if (sequenceKeysState.length > 0) {
              const potentialSequence = [...sequenceKeysState, key].join(' ');
              const matchingShortcut =
                shortcutRegistry.getShortcutForKey(potentialSequence);

              if (matchingShortcut && matchingShortcut.enabled !== false) {
                e.preventDefault();
                matchingShortcut.handler(e);
                setSequenceKeys([]);
                if (sequenceTimeoutRef.current) {
                  window.clearTimeout(sequenceTimeoutRef.current);
                }
                return;
              }
            }

            // Start or continue sequence
            handleSequenceKey(key);
          },
        });
      }
    });

    return hotkeys;
  }, [activeShortcuts, sequenceKeys, sequenceKeysState, handleSequenceKey]);

  // Use the existing useHotkeys hook
  useHotkeys(hotkeyConfig);

  // Show sequence indicator
  useEffect(() => {
    if (sequenceKeysState.length > 0) {
      // TODO: Show a visual indicator of the current sequence
    }
  }, [sequenceKeysState]);

  const contextValue = useMemo<ShortcutsContextValue>(
    () => ({
      registry: shortcutRegistry,
      activeShortcuts,
      registerContext,
      unregisterContext,
      isHelpModalOpen: false, // Modal state is managed by the modal system
      openHelpModal,
      closeHelpModal: () => {}, // No-op, modal handles its own closing
    }),
    [activeShortcuts, registerContext, unregisterContext, openHelpModal]
  );

  return (
    <ShortcutsContext.Provider value={contextValue}>{children}</ShortcutsContext.Provider>
  );
}

/**
 * Hook to access the shortcuts context
 */
export function useShortcuts() {
  const context = useContext(ShortcutsContext);
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutsProvider');
  }
  return context;
}
