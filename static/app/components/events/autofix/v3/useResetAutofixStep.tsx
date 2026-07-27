import {useMemo, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  type AutofixExplorerStep,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';

interface UseResetAutofixStepOptions {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
  step: AutofixExplorerStep;
  canReset?: boolean;
}

export function useResetAutofixStep({
  autofix,
  canReset,
  section,
  step,
}: UseResetAutofixStepOptions) {
  const [shouldShowReset, setShouldShowReset] = useState(false);

  const {runState, startStep} = autofix;
  const runId = getAutofixRunId(runState);
  const notProcessing = autofix.runState?.status !== 'processing';
  const noPRs = Object.values(autofix.runState?.repo_pr_states ?? {}).length === 0;
  const noCodingAgents =
    Object.values(autofix.runState?.coding_agents ?? {}).length === 0;
  const defaultCanReset = notProcessing && noPRs && noCodingAgents;

  const isResetEligible = canReset ?? defaultCanReset;

  const handleReset = useMemo(() => {
    return async (userContext?: string) => {
      // Dismiss the reset UI before kicking off the run so it doesn't reappear
      // once the run completes (during processing the loading view takes over).
      setShouldShowReset(false);
      try {
        await startStep(step, {runId, userContext, insertIndex: section.index});
      } catch {
        setShouldShowReset(true);
        addErrorMessage(t('Failed to reset. Please try again.'));
      }
    };
  }, [startStep, step, runId, section.index]);

  return {
    canReset:
      // can only reset if reset prompt is not showing
      !shouldShowReset && isResetEligible,
    shouldShowReset,
    setShouldShowReset,
    handleReset,
  };
}
