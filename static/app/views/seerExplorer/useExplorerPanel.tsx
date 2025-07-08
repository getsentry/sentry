import {useCallback, useState} from 'react';

// Global state for explorer panel
let globalExplorerPanelState = false;
let globalSetExplorerPanelState: ((isOpen: boolean) => void) | null = null;

/**
 * Hook to manage the global explorer panel state
 */
export function useExplorerPanel() {
  const [isOpen, setIsOpen] = useState(globalExplorerPanelState);

  // Register this hook instance as the global state setter
  if (!globalSetExplorerPanelState) {
    globalSetExplorerPanelState = setIsOpen;
  }

  const _openExplorerPanel = useCallback(() => {
    globalExplorerPanelState = true;
    globalSetExplorerPanelState?.(true);
  }, []);

  const _closeExplorerPanel = useCallback(() => {
    globalExplorerPanelState = false;
    globalSetExplorerPanelState?.(false);
  }, []);

  const _toggleExplorerPanel = useCallback(() => {
    const newState = !globalExplorerPanelState;
    globalExplorerPanelState = newState;
    globalSetExplorerPanelState?.(newState);
  }, []);

  return {
    isOpen,
    openExplorerPanel: _openExplorerPanel,
    closeExplorerPanel: _closeExplorerPanel,
    toggleExplorerPanel: _toggleExplorerPanel,
  };
}

/**
 * Function to open explorer panel from anywhere in the app
 */
export function openExplorerPanel() {
  globalExplorerPanelState = true;
  globalSetExplorerPanelState?.(true);
}

/**
 * Function to close explorer panel from anywhere in the app
 */
export function closeExplorerPanel() {
  globalExplorerPanelState = false;
  globalSetExplorerPanelState?.(false);
}

/**
 * Function to toggle explorer panel from anywhere in the app
 */
export function toggleExplorerPanel() {
  const newState = !globalExplorerPanelState;
  globalExplorerPanelState = newState;
  globalSetExplorerPanelState?.(newState);
}
