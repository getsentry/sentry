import {useCallback} from 'react';

import {useIsSeerCodeMode} from 'sentry/components/events/autofix/v3/useIsSeerCodeMode';
import {useAutofixChat} from 'sentry/components/seer/autofixChatContext';

/**
 * With code mode on, Seer Agent can drive the run itself, so the next-step
 * answers stop calling the Autofix endpoints and hand the question to the agent
 * instead. The prompt is submitted for the reader, since the point of the
 * buttons is that they do not have to phrase it.
 *
 * Posting through the chat context rather than opening the Explorer drawer
 * keeps the question on whichever surface is already showing — sidebar, drawer
 * or popped out — instead of stacking a second one beside it. Sending without
 * `newChat` adds to the run already open, so the question keeps the context on
 * screen that makes it answerable.
 *
 * `isCodeMode` is false when no chat is reachable, so callers keep the ordinary
 * Autofix buttons rather than offering a hand-off that goes nowhere.
 */
export function useAskSeerHandoff() {
  const {sendMessage} = useAutofixChat();
  const isCodeMode = useIsSeerCodeMode() && Boolean(sendMessage);

  const askSeer = useCallback(
    (prompt: string) => {
      sendMessage?.(prompt);
    },
    [sendMessage]
  );

  return {askSeer, isCodeMode};
}

/** Every step's "yes" asks for the same thing: get on with the run. */
export const ASK_SEER_CONTINUE_PROMPT = 'Run the next Autofix step';
