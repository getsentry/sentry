import {createContext, useContext, useMemo, type ReactNode} from 'react';

export type SendMessageOptions = {
  /**
   * Start a fresh conversation rather than adding to the one already open.
   * Defaults to appending, so a caller that just wants to say something to the
   * agent keeps whatever context the running conversation has built up.
   */
  newChat?: boolean;
};

type AutofixChatContextValue = {
  /**
   * Posts `query` into the chat as a new user message, opening the Explorer
   * first if it is not already open. Undefined wherever no provider is mounted
   * (Storybook) or the run is read-only, in which case callers render their
   * entry point disabled instead of acting.
   */
  sendMessage?: (query: string, options?: SendMessageOptions) => void;
};

const AutofixChatContext = createContext<AutofixChatContextValue>({});

/**
 * Gives anything in the app one way to drive the Seer agent: post a message
 * into the chat, rather than calling an agent API directly and leaving no
 * record of why the run advanced.
 *
 * Mounted at two levels, and the nesting is the point. The outer mount, in
 * `SeerExplorerContextProvider`, covers the whole organization layout, so a
 * button on issue details can hand over a message and get the Explorer opened
 * on it. The inner mount, in `SeerExplorerContent`, shadows it for anything
 * rendered inside the chat, where the panel is already open and the message
 * should append to the running conversation instead of starting a new one.
 *
 * Callers do not need to know which one they got. They call `sendMessage` and
 * the message lands in the chat either way. Passing `{newChat: true}` starts a
 * fresh conversation instead of adding to whatever is already open.
 */
export function AutofixChatProvider({
  children,
  sendMessage,
}: {
  children: ReactNode;
  sendMessage?: (query: string, options?: SendMessageOptions) => void;
}) {
  // The page re-renders on every poll; a stable value keeps that from
  // invalidating every consumer of this context.
  const value = useMemo(() => ({sendMessage}), [sendMessage]);

  return (
    <AutofixChatContext.Provider value={value}>{children}</AutofixChatContext.Provider>
  );
}

export function useAutofixChat(): AutofixChatContextValue {
  return useContext(AutofixChatContext);
}
