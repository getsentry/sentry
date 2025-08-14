import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {openModal} from 'sentry/actionCreators/modal';
import {useHotkeys} from 'sentry/utils/useHotkeys';

import {ShortcutsHelpModal} from './components/shortcutsHelpModal';
import {shortcutRegistry} from './registry';
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
  const sequenceTimeoutRef = useRef<number>();

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
    setActiveShortcuts(allShortcuts);
  }, []);

  const unregisterContext = useCallback((context: string) => {
    shortcutRegistry.unregisterContext(context);
    setActiveShortcuts(shortcutRegistry.getShortcuts());
  }, []);

  const openHelpModal = useCallback(() => {
    // Get the current shortcuts from the registry instead of using stale state
    const currentShortcuts = shortcutRegistry.getShortcuts();
    openModal(modalProps => (
      <ShortcutsHelpModal
        {...modalProps}
        activeShortcuts={currentShortcuts}
        registry={shortcutRegistry}
      />
    ));
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
    const hotkeys: Parameters<typeof useHotkeys>[0] = [];
    const processedKeys = new Set<string>();

    // First, handle single key shortcuts
    activeShortcuts.forEach(shortcut => {
      if (!shortcut.enabled) return;

      const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];

      keys.forEach(key => {
        const keyParts = key.split(' ');

        if (keyParts.length === 1 && !processedKeys.has(key)) {
          // Single key shortcut
          processedKeys.add(key);
          hotkeys.push({
            match: key,
            includeInputs: shortcut.allowInInputs,
            skipPreventDefault: !shortcut.preventDefault,
            callback: shortcut.handler,
          });
        }
      });
    });

    // Then, handle all keys that are part of sequences
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
