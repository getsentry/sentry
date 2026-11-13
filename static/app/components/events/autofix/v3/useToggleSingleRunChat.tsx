import {useCallback} from 'react';

import {useAutofixCreditsDisabled} from 'sentry/components/events/autofix/autofixCredits';
import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
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

export function useRerunSingleRun(
  autofix: ReturnType<typeof useExplorerAutofix>,
  {enabled}: {enabled: boolean}
) {
  const {startStep} = autofix;
  const openSingleRunChat = useOpenSingleRunChat();
  const disabled = useAutofixCreditsDisabled('root_cause', {enabled});

  const rerun = useCallback(async () => {
    const run = await startStep('root_cause');
    if (run.isSingleRun) {
      openSingleRunChat(run.runId);
    }
  }, [startStep, openSingleRunChat]);

  return {rerun, disabled};
}

export function useIsSingleRunChatOpen(runId: SeerExplorerRunId | undefined) {
  const {isOpen} = useSeerExplorerContext();
  const {runId: openRunId} = useSeerExplorerChatState();
  return runId !== undefined && isOpen && String(openRunId) === String(runId);
}
