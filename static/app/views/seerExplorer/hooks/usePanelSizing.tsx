import {useCallback, useState} from 'react';

import type {PanelSize} from 'sentry/views/seerExplorer/types';

export function usePanelSizing() {
  const [panelSize, setPanelSize] = useState<PanelSize>('med');

  const handleMaxSize = useCallback(() => {
    setPanelSize('max');
  }, []);

  const handleMedSize = useCallback(() => {
    setPanelSize('med');
  }, []);

  const handleMinSize = useCallback(() => {
    setPanelSize('min');
  }, []);

  return {
    panelSize,
    handleMaxSize,
    handleMedSize,
    handleMinSize,
  };
}
