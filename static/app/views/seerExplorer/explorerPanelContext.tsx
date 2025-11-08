import {createContext, useContext} from 'react';

import type {MenuMode} from './types';

export interface ExplorerPanelContextType {
  clearInput: () => void;
  focusedBlockIndex: number;
  inputValue: string;
  interruptRequested: boolean;
  isPolling: boolean;
  menuMode: MenuMode;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onInputClick: () => void;
  onMaxSize: () => void;
  onMedSize: () => void;
  onNew: () => void;
  onResume: (runId: number) => void;
  setMenuMode: (mode: MenuMode) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const ExplorerPanelContext = createContext<ExplorerPanelContextType | undefined>(
  undefined
);

export function useExplorerPanelContext() {
  const context = useContext(ExplorerPanelContext);
  if (context === undefined) {
    throw new Error(
      'Tried to read uninitialized ExplorerPanelContext. This hook should only be used within an ExplorerPanelContext.Provider'
    );
  }
  return context;
}

export default ExplorerPanelContext;
