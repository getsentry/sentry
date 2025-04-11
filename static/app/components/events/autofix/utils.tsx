import {formatRootCauseText} from 'sentry/components/events/autofix/autofixRootCause';
import {formatSolutionText} from 'sentry/components/events/autofix/autofixSolution';
import {
  type AutofixCodebaseChange,
  type AutofixData,
  AutofixStatus,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';

export const AUTOFIX_ROOT_CAUSE_STEP_ID = 'root_cause_analysis';

export function getRootCauseDescription(autofixData: AutofixData) {
  const rootCause = autofixData.steps?.find(
    step => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS
  );
  if (!rootCause) {
    return null;
  }
  return rootCause.causes.at(0)?.description ?? null;
}

export function getRootCauseCopyText(autofixData: AutofixData) {
  const rootCause = autofixData.steps?.find(
    step => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS
  );
  if (!rootCause) {
    return null;
  }

  const cause = rootCause.causes.at(0);

  if (!cause) {
    return null;
  }

  return formatRootCauseText(cause);
}

export function getSolutionDescription(autofixData: AutofixData) {
  const solution = autofixData.steps?.find(
    step => step.type === AutofixStepType.SOLUTION
  );
  if (!solution) {
    return null;
  }

  return solution.description ?? null;
}

export function getSolutionCopyText(autofixData: AutofixData) {
  const solution = autofixData.steps?.find(
    step => step.type === AutofixStepType.SOLUTION
  );
  if (!solution) {
    return null;
  }

  return formatSolutionText(solution.solution, solution.custom_solution);
}

export function getSolutionIsLoading(autofixData: AutofixData) {
  const solutionProgressStep = autofixData.steps?.find(
    step => step.key === 'solution_processing'
  );
  return solutionProgressStep?.status === AutofixStatus.PROCESSING;
}

export function getCodeChangesDescription(autofixData: AutofixData) {
  if (!autofixData) {
    return null;
  }

  const changesStep = autofixData.steps?.find(
    step => step.type === AutofixStepType.CHANGES
  );

  if (!changesStep) {
    return null;
  }

  // If there are changes with PRs, show links to them
  const changesWithPRs = changesStep.changes?.filter(
    (change: AutofixCodebaseChange) => change.pull_request
  );
  if (changesWithPRs?.length) {
    return changesWithPRs
      .map(
        (change: AutofixCodebaseChange) =>
          `[View PR in ${change.repo_name}](${change.pull_request?.pr_url})`
      )
      .join('\n');
  }

  // If there are code changes but no PRs yet, show a summary
  if (changesStep.changes?.length) {
    // Group changes by repo
    const changesByRepo: Record<string, number> = {};
    changesStep.changes.forEach((change: AutofixCodebaseChange) => {
      changesByRepo[change.repo_name] = (changesByRepo[change.repo_name] || 0) + 1;
    });

    const changesSummary = Object.entries(changesByRepo)
      .map(([repo, count]) => `${count} ${count === 1 ? 'change' : 'changes'} in ${repo}`)
      .join(', ');

    return `Proposed ${changesSummary}.`;
  }

  return null;
}

export const getCodeChangesIsLoading = (autofixData: AutofixData) => {
  if (!autofixData) {
    return false;
  }

  // Check if there's a specific changes processing step, similar to solution_processing
  const changesProgressStep = autofixData.steps?.find(step => step.key === 'plan');
  if (changesProgressStep?.status === AutofixStatus.PROCESSING) {
    return true;
  }

  // Also check if the changes step itself is in processing state
  const changesStep = autofixData.steps?.find(
    step => step.type === AutofixStepType.CHANGES
  );

  return changesStep?.status === AutofixStatus.PROCESSING;
};

export const isSupportedAutofixProvider = (provider: string) => {
  return provider.toLowerCase().includes('github');
};

/**
 * Calculates the progress percentage for the autofix process based on steps.
 * Progress percentages:
 * - 0%: haven't started
 * - 0-32%: root cause processing (increases by 2% per iteration)
 * - 33%: root cause present
 * - 33-66%: solution processing (increases by 2% per iteration)
 * - 67%: solution present
 * - 67-99%: coding / planning (increases by 2% per iteration)
 * - 100%: code changes present
 */
export function getAutofixProgressPercentage(autofixData?: AutofixData): number {
  if (!autofixData) {
    return 0;
  }

  // Find key steps if they exist
  const steps = autofixData.steps ?? [];
  const rootCauseStep = steps.find(
    step => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS
  );
  const solutionStep = steps.find(step => step.type === AutofixStepType.SOLUTION);
  const changesStep = steps.find(step => step.type === AutofixStepType.CHANGES);

  // Find potential processing steps (assuming default type and specific keys)
  const rootCauseProcessingStep = steps.find(
    step =>
      step.key === 'root_cause_analysis_processing' &&
      step.type === AutofixStepType.DEFAULT
  );
  const solutionProcessingStep = steps.find(
    step => step.key === 'solution_processing' && step.type === AutofixStepType.DEFAULT
  );
  const planStep = steps.find(
    step => step.key === 'plan' && step.type === AutofixStepType.DEFAULT
  );

  // Code changes complete
  if (changesStep && changesStep.status === AutofixStatus.COMPLETED) {
    return 100;
  }
  // Coding / Planning in progress
  if (planStep && planStep.status === AutofixStatus.PROCESSING) {
    const basePercentage = 67;
    const maxPercentage = 99;
    const progressCount = planStep.progress?.length || 0;
    const calculatedPercentage = basePercentage + progressCount * 2;
    return Math.min(calculatedPercentage, maxPercentage);
  }

  // Solution present
  if (
    solutionStep &&
    (solutionStep.status === AutofixStatus.COMPLETED || solutionStep.solution_selected)
  ) {
    return 67;
  }
  // Solution processing
  if (
    solutionProcessingStep &&
    solutionProcessingStep.status === AutofixStatus.PROCESSING
  ) {
    const basePercentage = 33;
    const maxPercentage = 66;
    const progressCount = solutionProcessingStep.progress?.length || 0;
    const calculatedPercentage = basePercentage + progressCount * 2;
    return Math.min(calculatedPercentage, maxPercentage);
  }
  // Fallback for solution processing if key step missing
  if (
    solutionStep &&
    solutionStep.status === AutofixStatus.PROCESSING &&
    !solutionProcessingStep
  ) {
    const basePercentage = 33;
    const maxPercentage = 66;
    const progressCount = solutionStep.progress?.length || 0;
    const calculatedPercentage = basePercentage + progressCount * 2;
    return Math.min(calculatedPercentage, maxPercentage);
  }
  // Root cause present
  if (
    rootCauseStep &&
    (rootCauseStep.status === AutofixStatus.COMPLETED || rootCauseStep.selection)
  ) {
    return 33;
  }
  // Root cause processing
  if (
    rootCauseProcessingStep &&
    rootCauseProcessingStep.status === AutofixStatus.PROCESSING
  ) {
    const basePercentage = 0;
    const maxPercentage = 32;
    const progressCount = rootCauseProcessingStep.progress?.length || 0;
    const calculatedPercentage = basePercentage + progressCount * 2;
    return progressCount > 0
      ? Math.min(Math.max(calculatedPercentage, 1), maxPercentage)
      : 0;
  }

  // No steps match specific phases, use overall status as fallback
  switch (autofixData.status) {
    case AutofixStatus.PROCESSING:
      return 1; // Assume just started processing if no specific steps
    case AutofixStatus.COMPLETED:
      return 100;
    case AutofixStatus.NEED_MORE_INFORMATION:
    case AutofixStatus.WAITING_FOR_USER_RESPONSE:
      if (rootCauseStep && !rootCauseStep.selection) {
        return 33;
      }
      if (solutionStep && !solutionStep.solution_selected) {
        return 67;
      }
      return 50;
    case AutofixStatus.ERROR:
    case AutofixStatus.CANCELLED:
    default:
      return 0;
  }
}
