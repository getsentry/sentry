import {useCallback} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import type {PanelSize} from 'sentry/views/seerExplorer/types';

const PANEL_SIZE_STORAGE_KEY = 'seer-explorer-panel-size';

export function usePanelSizing() {
  const [panelSize, setPanelSize] = useLocalStorageState<PanelSize>(
    PANEL_SIZE_STORAGE_KEY,
    'med'
  );

  const handleMaxSize = useCallback(() => {
    setPanelSize('max');
  }, [setPanelSize]);

  const handleMedSize = useCallback(() => {
    setPanelSize('med');
  }, [setPanelSize]);

  return {
    panelSize,
    handleMaxSize,
    handleMedSize,
  };
}
