import {useMemo, useState} from 'react';

import {
  type AutofixExplorerStep,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';

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

  const {runState, startStep} = autofix;
  const runId = runState?.run_id;

  const handleReset = useMemo(() => {
    return (userContext?: string) => {
      startStep(step, {runId, userContext, insertIndex: section.index});
    };
  }, [startStep, step, runId, section.index]);

  return {
    canReset:
      // can only reset if reset prompt is not showing
      !shouldShowReset &&
      // can only reset if run state is not processing
      autofix.runState?.status !== 'processing' &&
      // can only reset if PRs states are empty (i.e. no PR have been created)
      Object.values(autofix.runState?.repo_pr_states ?? {}).length === 0 &&
      // can only reset if coding agents are empty (i.e. no coding agents have been started)
      Object.values(autofix.runState?.coding_agents ?? {}).length === 0,
    shouldShowReset,
    setShouldShowReset,
    handleReset,
  };
}
