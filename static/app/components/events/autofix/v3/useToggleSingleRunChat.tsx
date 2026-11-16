import {useCallback} from 'react';

import {useAutofixCreditsDisabled} from 'sentry/components/events/autofix/autofixCredits';
import {
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isRootCauseArtifact,
  isRootCauseSection,
  type ExplorerAutofixState,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  useSeerExplorerChatDispatch,
  useSeerExplorerChatState,
} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

export function useOpenSingleRunChat() {
  const {openSeerExplorer} = useSeerExplorerContext();
  const dispatch = useSeerExplorerChatDispatch();

  return useCallback(
    (runId: SeerExplorerRunId) => {
      dispatch({type: 'set run id', payload: runId});
      openSeerExplorer({runId});
    },
    [dispatch, openSeerExplorer]
  );
}

export function withPreviousAttempt(
  runState: ExplorerAutofixState | null,
  feedback: string
): string {
  const section = getOrderedAutofixSections(runState).findLast(isRootCauseSection);
  const artifact = section ? getAutofixArtifactFromSection(section) : null;
  const headline = isRootCauseArtifact(artifact)
    ? artifact.data?.one_line_description
    : undefined;
  if (!headline) {
    return feedback;
  }
  return `Starting over. Last attempt found: ${headline}\n\nFeedback: ${feedback}`;
}

export function useRerunSingleRun(
  autofix: ReturnType<typeof useExplorerAutofix>,
  {enabled}: {enabled: boolean}
) {
  const {startStep, runState} = autofix;
  const openSingleRunChat = useOpenSingleRunChat();
  const disabled = useAutofixCreditsDisabled('root_cause', {enabled});

  const rerun = useCallback(
    async (feedback?: string) => {
      const userContext = feedback ? withPreviousAttempt(runState, feedback) : feedback;
      const run = await startStep('root_cause', {userContext});
      if (run.isSingleRun) {
        openSingleRunChat(run.runId);
      }
    },
    [startStep, openSingleRunChat, runState]
  );

  return {rerun, disabled};
}

export function useIsSingleRunChatOpen(runId: SeerExplorerRunId | undefined) {
  const {isOpen} = useSeerExplorerContext();
  const {runId: openRunId} = useSeerExplorerChatState();
  return runId !== undefined && isOpen && String(openRunId) === String(runId);
}
