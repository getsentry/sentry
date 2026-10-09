import {useCallback} from 'react';

import {useAutofixChat} from 'sentry/components/seer/autofixChatContext';
import {useOrganization} from 'sentry/utils/useOrganization';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/isSeerExplorerEnabled';

/**
 * With code mode on, Seer Agent can drive the run itself, so a next step's "no"
 * hands the question to the agent instead of collecting context for another
 * Autofix step. The prompt is submitted for the reader, since the point of the
 * button is that they do not have to phrase it. "Yes" still runs the next
 * Autofix step.
 *
 * Posting through the chat context rather than opening the Explorer drawer
 * keeps the question on whichever surface is already showing instead of
 * stacking a second one beside it. Sending without `newChat` adds to the run
 * already open, so the question keeps the context on screen that makes it
 * answerable.
 *
 * `isCodeMode` needs the flag, the Explorer's own prerequisites, and a chat
 * that can take the message; anything that behaves differently in code mode
 * reads it here, so none of them can disagree about it.
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
