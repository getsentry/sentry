import {createContext, useCallback, useContext, useState} from 'react';

type OpenExplorerPanelFn = () => void;

const OpenExplorerPanelContext = createContext<OpenExplorerPanelFn | null>(null);

export const OpenExplorerPanelProvider = OpenExplorerPanelContext.Provider;

/**
 * Hook to programmatically open the Seer Explorer panel.
 * Must be used within OpenExplorerPanelProvider.
 */
export function useOpenExplorerPanel(): OpenExplorerPanelFn {
  const openPanel = useContext(OpenExplorerPanelContext);
  if (!openPanel) {
    // Return no-op if used outside provider (e.g., in tests)
    return () => {};
  }
  return openPanel;
}

export function useExplorerPanel() {
  const [isOpen, setIsOpen] = useState(false);

  const _openExplorerPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  const _closeExplorerPanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const _toggleExplorerPanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    isOpen,
    openExplorerPanel: _openExplorerPanel,
    closeExplorerPanel: _closeExplorerPanel,
    toggleExplorerPanel: _toggleExplorerPanel,
  };
}
