import {useMemo, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  isRunValidForPrIteration,
  type AutofixExplorerStep,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

interface UseResetAutofixStepOptions {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
  step: AutofixExplorerStep;
}

export function useResetAutofixStep({
  autofix,
  section,
  step,
}: UseResetAutofixStepOptions) {
  const [shouldShowReset, setShouldShowReset] = useState(false);

  const organization = useOrganization();
  const {runState, startStep} = autofix;
  const runId = runState?.run_id;
  const allowResetAfterPRs = isRunValidForPrIteration(organization);

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
      !shouldShowReset &&
      // can only reset if run state is not processing
      autofix.runState?.status !== 'processing' &&
      // can only reset if PRs states are empty (i.e. no PR have been created),
      // except on code_changes card where PR iteration is supported
      (step === 'code_changes'
        ? allowResetAfterPRs ||
          Object.values(autofix.runState?.repo_pr_states ?? {}).length === 0
        : Object.values(autofix.runState?.repo_pr_states ?? {}).length === 0) &&
      // can only reset if coding agents are empty (i.e. no coding agents have been started)
      Object.values(autofix.runState?.coding_agents ?? {}).length === 0,
    shouldShowReset,
    setShouldShowReset,
    handleReset,
  };
}
