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

import type {SeerCreditDenialReason} from 'sentry/utils/seer/useSeerCreditCheck';

export type SendMessageOptions = {
  /** Start a fresh conversation instead of adding to the one already open. */
  newChat?: boolean;
};

type ReportOutOfCredits = (
  embedId: string,
  isOutOfCredits: boolean,
  denialReason: SeerCreditDenialReason | null
) => void;

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
 * next, and why, so the chat shows one notice for all of them. Pass
 * `reportOutOfCredits` to `AutofixChatProvider`.
 */
export function useAutofixOutOfCreditsEmbeds() {
  // The denial reason each embed that can't afford its next step reported.
  const [denials, setDenials] = useState<
    ReadonlyMap<string, SeerCreditDenialReason | null>
  >(() => new Map());

  const reportOutOfCredits = useCallback<ReportOutOfCredits>(
    (embedId, isOutOfCredits, denialReason) => {
      setDenials(current => {
        // Every embed reports on mount, and most can afford their step. Skip
        // those so the chat doesn't re-render for nothing.
        if (!isOutOfCredits && !current.has(embedId)) {
          return current;
        }
        const next = new Map(current);
        if (isOutOfCredits) {
          next.set(embedId, denialReason);
        } else {
          next.delete(embedId);
        }
        return next;
      });
    },
    []
  );

  const reasons = [...denials.values()];
  return {
    isAutofixOutOfCredits: denials.size > 0,
    // The daily usage limit is the org's, so one embed hitting it means they
    // all have.
    autofixDenialReason:
      reasons.find(reason => reason === 'daily_cap_exceeded') ?? reasons[0] ?? null,
    reportOutOfCredits,
  };
}

/**
 * For an embed: tells the chat around it whether it can't afford the step it
 * offers next, and why. Returns whether the embed has to show the notice
 * itself, which it does only outside the chat, where nothing else would.
 */
export function useReportAutofixOutOfCredits(
  isOutOfCredits: boolean,
  denialReason: SeerCreditDenialReason | null
): boolean {
  const {reportOutOfCredits} = useAutofixChat();
  const embedId = useId();

  useEffect(() => {
    if (!reportOutOfCredits) {
      return;
    }
    reportOutOfCredits(embedId, isOutOfCredits, denialReason);
    return () => reportOutOfCredits(embedId, false, null);
  }, [embedId, isOutOfCredits, denialReason, reportOutOfCredits]);

  return isOutOfCredits && !reportOutOfCredits;
}
