import {useCallback} from 'react';

import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

interface UseAskSeerOptions {
  /** The question Seer asks. Shown as Seer's, and sent with the user's reply. */
  prompt: string;
  /** What the entry point is about. Any JSON-serializable value, captured on click. */
  context?: unknown;
  /**
   * The conversation the question belongs to, for entry points that are views of a run
   * (like an Autofix step). Omit it and the question joins whatever Explorer shows.
   */
  runId?: SeerExplorerRunId;
}

/**
 * Click handler for an "Ask Seer" entry point: opens Explorer on a question from Seer and
 * sends nothing until the user replies. The question joins the conversation on screen, or
 * starts a new chat when Explorer is closed; callers can't know what the chat holds.
 * Callers that do own a run pass `runId` to ask there instead.
 */
export function useAskSeer({prompt, context, runId}: UseAskSeerOptions) {
  const {openSeerExplorer} = useSeerExplorerContext();

  return useCallback(() => {
    openSeerExplorer({
      chatPrompt: {
        text: prompt,
        context: serializeContext(context),
        openedAt: Date.now(),
      },
      runId,
    });
  }, [openSeerExplorer, prompt, context, runId]);
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
