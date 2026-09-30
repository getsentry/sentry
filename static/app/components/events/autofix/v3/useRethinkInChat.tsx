import {useCallback} from 'react';

import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useOrganization} from 'sentry/utils/useOrganization';
import {hasAutofixPage} from 'sentry/views/issueDetails/autofix/utils';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

interface UseRethinkInChatOptions {
  /** Seer's question, e.g. "How can this root cause be improved?". */
  prompt: string;
  step: AutofixExplorerStep;
}

/**
 * On the Autofix page, asking for changes to a step opens Seer Agent with Seer
 * asking what to change, so the reader answers in the chat instead of a one-shot
 * textarea. The question continues the reader's own chat on screen or starts a new
 * one; it never opens the Autofix run, whose transcript is Autofix's internal
 * working. Returns undefined where that isn't available, and callers keep their
 * textarea.
 */
export function useRethinkInChat({
  prompt,
  step,
}: UseRethinkInChatOptions): (() => void) | undefined {
  const organization = useOrganization();
  const {openChatPrompt} = useSeerExplorerContext();
  const askSeer = useCallback(
    () => openChatPrompt({prompt, context: {autofixStep: step}}),
    [openChatPrompt, prompt, step]
  );

  const isAvailable =
    hasAutofixPage(organization) &&
    // The chat endpoint drops the question without this flag.
    organization.features.includes('seer-explorer-chat-prompts') &&
    isSeerExplorerEnabled(organization);

  return isAvailable ? askSeer : undefined;
}
