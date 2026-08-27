import {createContext, useContext, useMemo, type ReactNode} from 'react';

type AutofixChatContextValue = {
  /**
   * Posts `query` into the chat as a new user message. Undefined wherever no
   * chat is mounted (Storybook) or the run is read-only, in which case callers
   * render their entry point disabled instead of acting.
   */
  sendMessage?: (query: string) => void;
};

const AutofixChatContext = createContext<AutofixChatContextValue>({});

/**
 * Wraps the Seer Explorer page so anything rendered inside it — a markdown
 * embed, a block widget, a header button — can drive the agent by posting a
 * message into the chat rather than calling the autofix API directly. The
 * transcript then keeps a timestamped record of the action, and the agent
 * reacts to it exactly as it would to a typed message.
 */
export function AutofixChatProvider({
  children,
  sendMessage,
}: {
  children: ReactNode;
  sendMessage?: (query: string) => void;
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
