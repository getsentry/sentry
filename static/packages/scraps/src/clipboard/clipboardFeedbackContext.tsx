import {createContext, useContext} from 'react';

/** Optional application feedback after a clipboard write. */
export interface ClipboardFeedback {
  onCopy?: (text: string) => void;
  onError?: (error: unknown) => void;
}

const ClipboardFeedbackContext = createContext<ClipboardFeedback>({});

export const ClipboardFeedbackContextProvider = ClipboardFeedbackContext.Provider;

export function useClipboardFeedback() {
  return useContext(ClipboardFeedbackContext);
}
