import {useCallback, useState} from 'react';

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
