import {createContext, useContext} from 'react';

export interface ExplorerPanelContextType {
  clearInput: () => void;
  focusedBlockIndex: number;
  inputValue: string;
  interruptRequested: boolean;
  isPolling: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onInputClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMaxSize: () => void;
  onMedSize: () => void;
  onMenuVisibilityChange: (isVisible: boolean) => void;
  onNew: () => void;
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
