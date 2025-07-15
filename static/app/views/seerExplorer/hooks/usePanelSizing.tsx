import {useCallback, useState} from 'react';

import type {PanelSize} from 'sentry/views/seerExplorer/types';

export function usePanelSizing() {
  const [panelSize, setPanelSize] = useState<PanelSize>('med');
  const [lastNonMinSize, setLastNonMinSize] = useState<'max' | 'med'>('med');

  const handleMaxSize = useCallback(() => {
    setPanelSize('max');
    setLastNonMinSize('max');
  }, []);

  const handleMedSize = useCallback(() => {
    setPanelSize('med');
    setLastNonMinSize('med');
  }, []);

  const handleMinSize = useCallback(() => {
    setPanelSize('min');
  }, []);

  const handleMinPanelClick = useCallback(() => {
    setPanelSize(lastNonMinSize);
  }, [lastNonMinSize]);

  return {
    panelSize,
    handleMaxSize,
    handleMedSize,
    handleMinSize,
    handleMinPanelClick,
  };
}
