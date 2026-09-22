import {useCallback} from 'react';

import {useAutofixChat} from 'sentry/components/seer/autofixChatContext';
import {useOrganization} from 'sentry/utils/useOrganization';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

/**
 * With code mode on, Seer Agent can drive the run itself, so the next-step
 * answers stop calling the Autofix endpoints and hand the question to the agent
 * instead. The prompt is submitted for the reader, since the point of the
 * buttons is that they do not have to phrase it.
 *
 * Posting through the chat context rather than opening the Explorer drawer
 * keeps the question on whichever surface is already showing instead of
 * stacking a second one beside it. Sending without `newChat` adds to the run
 * already open, so the question keeps the context on screen that makes it
 * answerable.
 *
 * `isCodeMode` is the single answer to "has this run been handed to the agent".
 * It needs the flag, the Explorer's own prerequisites, and a chat that can take
 * the message; anything that behaves differently in code mode — the buttons, the
 * pull-request gate, the notifications prompt — reads it here, so none of them
 * can disagree about which path a click will take.
 */
export function useAskSeerHandoff() {
  const organization = useOrganization();
  const {sendMessage} = useAutofixChat();

  const isCodeMode =
    organization.features.includes('seer-explorer-code-mode-tools') &&
    isSeerExplorerEnabled(organization) &&
    Boolean(sendMessage);

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
