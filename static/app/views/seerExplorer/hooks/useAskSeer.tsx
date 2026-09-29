import {useCallback} from 'react';

import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

interface UseAskSeerOptions {
  /** The question Seer asks. Shown as Seer's, and sent with the user's reply. */
  prompt: string;
  /** What the entry point is about. Any JSON-serializable value, captured on click. */
  context?: unknown;
}

/**
 * Click handler for an "Ask Seer" entry point: opens Explorer on a question from Seer and
 * sends nothing until the user replies. The question joins the conversation on screen, or
 * starts a new chat when Explorer is closed; callers can't know what the chat holds.
 */
export function useAskSeer({prompt, context}: UseAskSeerOptions) {
  const {openSeerExplorer} = useSeerExplorerContext();

  return useCallback(() => {
    openSeerExplorer({
      chatPrompt: {
        text: prompt,
        context: serializeContext(context),
        openedAt: Date.now(),
      },
    });
  }, [openSeerExplorer, prompt, context]);
}

function serializeContext(context: unknown): string | undefined {
  if (context === undefined) {
    return undefined;
  }
  try {
    return JSON.stringify(context);
  } catch {
    // Not serializable (e.g. circular); the question still works without it.
    return undefined;
  }
}
