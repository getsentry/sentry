import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type SendMessageOptions = {
  /** Start a fresh conversation instead of adding to the one already open. */
  newChat?: boolean;
};

type ReportOutOfCredits = (embedId: string, isOutOfCredits: boolean) => void;

type AutofixChatContextValue = {
  /**
   * Whether the agent is still working on the message it was last sent.
   *
   * Autofix run state is the slower signal — the agent works through the
   * backend, so nothing here learns of it until a poll, and an idle run is not
   * polled at all. Controls that drive the agent read this, so they all settle
   * the moment any one of them is used.
   */
  isBusy?: boolean;
  /**
   * Set inside the Explorer chat, which shows one out-of-credits notice above
   * its composer for all its embeds. Undefined elsewhere, where an embed shows
   * its own. See `useReportAutofixOutOfCredits`.
   */
  reportOutOfCredits?: ReportOutOfCredits;
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
  isBusy = false,
  reportOutOfCredits,
  sendMessage,
}: {
  children: ReactNode;
  isBusy?: boolean;
  reportOutOfCredits?: ReportOutOfCredits;
  sendMessage?: (query: string, options?: SendMessageOptions) => void;
}) {
  // The page re-renders on every poll; don't invalidate every consumer.
  const value = useMemo(
    () => ({isBusy, reportOutOfCredits, sendMessage}),
    [isBusy, reportOutOfCredits, sendMessage]
  );

  return (
    <AutofixChatContext.Provider value={value}>{children}</AutofixChatContext.Provider>
  );
}

export function useAutofixChat(): AutofixChatContextValue {
  return useContext(AutofixChatContext);
}

/**
 * For the chat: whether any of its embeds can't afford the step it offers
 * next, so the chat shows one notice for all of them. Pass
 * `reportOutOfCredits` to `AutofixChatProvider`.
 */
export function useAutofixOutOfCreditsEmbeds() {
  const [embedIds, setEmbedIds] = useState<ReadonlySet<string>>(() => new Set());

  const reportOutOfCredits = useCallback<ReportOutOfCredits>(
    (embedId, isOutOfCredits) => {
      setEmbedIds(current => {
        if (current.has(embedId) === isOutOfCredits) {
          return current;
        }
        const next = new Set(current);
        if (isOutOfCredits) {
          next.add(embedId);
        } else {
          next.delete(embedId);
        }
        return next;
      });
    },
    []
  );

  return {isAutofixOutOfCredits: embedIds.size > 0, reportOutOfCredits};
}

/**
 * For an embed: tells the chat around it whether it can't afford the step it
 * offers next. Returns whether the embed has to show the notice itself, which
 * it does only outside the chat, where nothing else would.
 */
export function useReportAutofixOutOfCredits(isOutOfCredits: boolean): boolean {
  const {reportOutOfCredits} = useAutofixChat();
  const embedId = useId();

  useEffect(() => {
    if (!reportOutOfCredits) {
      return;
    }
    reportOutOfCredits(embedId, isOutOfCredits);
    return () => reportOutOfCredits(embedId, false);
  }, [embedId, isOutOfCredits, reportOutOfCredits]);

  return isOutOfCredits && !reportOutOfCredits;
}
