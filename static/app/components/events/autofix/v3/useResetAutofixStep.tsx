import {useEffect, useMemo, useRef, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  getCreatedPullRequestStates,
  type AutofixExplorerStep,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useRetryStep} from 'sentry/components/events/autofix/v3/retryStepContext';
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
  const cardRef = useRef<HTMLDivElement>(null);

  const {runState, startStep} = autofix;
  const runId = getAutofixRunId(runState);
  const notProcessing = autofix.runState?.status !== 'processing';
  const noPRs = getCreatedPullRequestStates(autofix.runState).length === 0;
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

  // Something outside this card (the drawer's workflow-file banner, today) can
  // ask for this step's retry prompt. Open it and bring it into view rather
  // than re-running the step behind the user's back.
  const retryStep = useRetryStep();
  const isRetryRequested = retryStep?.requestedStep === step;
  const clearRetryRequest = retryStep?.clearRequest;

  useEffect(() => {
    if (!isRetryRequested) {
      return;
    }
    clearRetryRequest?.();
    if (!isResetEligible) {
      return;
    }
    setShouldShowReset(true);
    // The prompt autofocuses its textarea once mounted; scrolling the whole
    // card into view keeps the surrounding context visible with it.
    cardRef.current?.scrollIntoView({behavior: 'smooth', block: 'center'});
  }, [isRetryRequested, clearRetryRequest, isResetEligible]);

  return {
    cardRef,
    canReset:
      // can only reset if reset prompt is not showing
      !shouldShowReset && isResetEligible,
    shouldShowReset,
    setShouldShowReset,
    handleReset,
  };
}
