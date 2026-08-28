import {createContext, useContext, useMemo, type ReactNode} from 'react';

export type SendMessageOptions = {
  /** Start a fresh conversation instead of adding to the one already open. */
  newChat?: boolean;
};

type AutofixChatContextValue = {
  /**
   * Undefined when no provider is above the caller, or the run is read-only —
   * render the entry point disabled rather than silently doing nothing.
   */
  sendMessage?: (query: string, options?: SendMessageOptions) => void;
};

const AutofixChatContext = createContext<AutofixChatContextValue>({});

/**
 * Lets anything in the app drive the Seer agent by posting into the chat.
 *
 * Mounted twice: `SeerExplorerContextProvider` covers the org layout and opens
 * the Explorer on the message, while `SeerExplorerContent` shadows it inside
 * the chat, where the panel is already open. Callers need not know which.
 */
export function AutofixChatProvider({
  children,
  sendMessage,
}: {
  children: ReactNode;
  sendMessage?: (query: string, options?: SendMessageOptions) => void;
}) {
  // The page re-renders on every poll; don't invalidate every consumer.
  const value = useMemo(() => ({sendMessage}), [sendMessage]);

  return (
    <AutofixChatContext.Provider value={value}>{children}</AutofixChatContext.Provider>
  );
}

export function useAutofixChat(): AutofixChatContextValue {
  return useContext(AutofixChatContext);
}
