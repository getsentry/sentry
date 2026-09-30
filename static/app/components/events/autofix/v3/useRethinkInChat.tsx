import {useMemo} from 'react';

import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {hasAutofixPage} from 'sentry/views/issueDetails/autofix/utils';
import {useAskSeer} from 'sentry/views/seerExplorer/hooks/useAskSeer';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

interface UseRethinkInChatOptions {
  /** Seer's question, e.g. "How can this root cause be improved?". */
  prompt: string;
  runId: SeerExplorerRunId | undefined;
  step: AutofixExplorerStep;
}

/**
 * On the Autofix page, asking for changes to a step opens Seer Agent on this run
 * with Seer asking what to change, so the reader answers in the chat instead of a
 * one-shot textarea. Returns undefined where that isn't available, and callers keep
 * their textarea.
 */
export function useRethinkInChat({
  prompt,
  runId,
  step,
}: UseRethinkInChatOptions): (() => void) | undefined {
  const organization = useOrganization();
  const context = useMemo(() => ({autofixStep: step}), [step]);
  const askSeer = useAskSeer({prompt, context, runId});

  const isAvailable =
    defined(runId) &&
    hasAutofixPage(organization) &&
    // The chat endpoint drops the question without this flag.
    organization.features.includes('seer-explorer-chat-prompts') &&
    isSeerExplorerEnabled(organization);

  return isAvailable ? askSeer : undefined;
}
