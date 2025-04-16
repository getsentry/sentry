import {formatRootCauseText} from 'sentry/components/events/autofix/autofixRootCause';
import {formatSolutionText} from 'sentry/components/events/autofix/autofixSolution';
import {
  type AutofixCodebaseChange,
  type AutofixData,
  AutofixStatus,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import {t} from 'sentry/locale';

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

export interface AutofixProgressDetails {
  displayText: string;
  icon: 'loading' | 'waiting' | null;
  overallProgress: number; // Overall progress (0-100)
}

/**
 * Calculate progress for the root cause and solution analysis steps
 * 0-50%: Root cause analysis
 * 50-100%: Solution generation
 */
function calculateAnalysisProgress(autofixData: AutofixData): number {
  const steps = autofixData.steps ?? [];
  const rootCauseStep = steps.find(
    step => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS
  );
  const solutionStep = steps.find(step => step.type === AutofixStepType.SOLUTION);
  const rootCauseProcessingStep = steps.find(
    step =>
      step.key === 'root_cause_analysis_processing' &&
      step.type === AutofixStepType.DEFAULT
  );
  const solutionProcessingStep = steps.find(
    step => step.key === 'solution_processing' && step.type === AutofixStepType.DEFAULT
  );

  // Solution processing started or completed?
  const solutionStarted = !!(
    solutionStep?.status === AutofixStatus.PROCESSING ||
    solutionProcessingStep?.status === AutofixStatus.PROCESSING ||
    (solutionStep &&
      (solutionStep.status === AutofixStatus.COMPLETED || solutionStep.solution_selected))
  );

  // Solution complete or selected?
  if (
    solutionStep &&
    (solutionStep.status === AutofixStatus.COMPLETED || solutionStep.solution_selected)
  ) {
    return 100; // Solution complete = 100%
  }

  // Solution processing?
  if (
    solutionProcessingStep?.status === AutofixStatus.PROCESSING ||
    (solutionStep?.status === AutofixStatus.PROCESSING && !solutionProcessingStep)
  ) {
    const processingStep = solutionProcessingStep ?? solutionStep;
    const progressCount = processingStep?.progress?.length || 0;
    // Start at 50% (root cause complete) and add 5% per progress log, max 99%
    return Math.min(50 + progressCount * 5, 99);
  }

  // Root cause complete or selected, but solution not started?
  if (
    rootCauseStep &&
    (rootCauseStep.status === AutofixStatus.COMPLETED || rootCauseStep.selection) &&
    !solutionStarted
  ) {
    return 50; // Root cause complete, waiting for solution = exactly 50%
  }

  // Root cause processing?
  if (
    rootCauseProcessingStep?.status === AutofixStatus.PROCESSING ||
    (rootCauseStep?.status === AutofixStatus.PROCESSING && !rootCauseProcessingStep)
  ) {
    const processingStep = rootCauseProcessingStep ?? rootCauseStep;
    const progressCount = processingStep?.progress?.length || 0;
    // Start at 0% and add 3% per progress log, max 49%
    return Math.min(progressCount * 3, 49);
  }

  // Default: no clear progress identified
  return 0;
}

/**
 * Calculate progress for the coding step (0-100%)
 * Increments by 7% per progress log
 */
function calculateCodingProgress(autofixData: AutofixData): number {
  const steps = autofixData.steps ?? [];
  const changesStep = steps.find(step => step.type === AutofixStepType.CHANGES);
  const planStep = steps.find(
    step => step.key === 'plan' && step.type === AutofixStepType.DEFAULT
  );

  // Changes complete?
  if (changesStep?.status === AutofixStatus.COMPLETED) {
    return 100;
  }

  // Changes exist but not completed?
  if (changesStep) {
    return 100; // Assume coding is complete if changes exist
  }

  // Plan processing?
  if (planStep?.status === AutofixStatus.PROCESSING) {
    const progressCount = planStep.progress?.length || 0;
    // Add 7% per progress log, max 99%
    return Math.min((progressCount - 1) * 7 + 1, 99);
  }

  // Default: no coding progress
  return 0;
}

/**
 * Determines the current specific status text, icon, and overall progress
 * based on the active step in the Autofix process.
 *
 * Progress is tracked separately for analysis (0-50% root cause, 50-100% solution)
 * and coding (0-100%).
 */
export function getAutofixProgressDetails(
  autofixData?: AutofixData
): AutofixProgressDetails {
  if (!autofixData) {
    return {displayText: t('Initializing...'), icon: null, overallProgress: 0};
  }

  const steps = autofixData.steps ?? [];
  const rootCauseStep = steps.find(
    step => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS
  );
  const solutionStep = steps.find(step => step.type === AutofixStepType.SOLUTION);
  const changesStep = steps.find(step => step.type === AutofixStepType.CHANGES);
  const planStep = steps.find(
    step => step.key === 'plan' && step.type === AutofixStepType.DEFAULT
  );
  const rootCauseProcessingStep = steps.find(
    step =>
      step.key === 'root_cause_analysis_processing' &&
      step.type === AutofixStepType.DEFAULT
  );
  const solutionProcessingStep = steps.find(
    step => step.key === 'solution_processing' && step.type === AutofixStepType.DEFAULT
  );

  // Terminal states first
  if (autofixData.status === AutofixStatus.ERROR) {
    return {displayText: t('Something broke.'), icon: null, overallProgress: 0};
  }

  if (autofixData.status === AutofixStatus.CANCELLED) {
    return {displayText: t('Cancelled.'), icon: null, overallProgress: 0};
  }

  // Determine which phase we're in (coding or analysis)
  const isCodingPhase = !!(planStep?.status === AutofixStatus.PROCESSING || changesStep);

  let displayText = t('Initializing...');
  let icon: 'loading' | 'waiting' | null = null;
  let overallProgress = 0;

  if (isCodingPhase) {
    overallProgress = calculateCodingProgress(autofixData);

    if (planStep?.status === AutofixStatus.PROCESSING) {
      displayText = t(
        "Autofix is coding with gusto. Feel free to leave - it'll continue in the background."
      );
      icon = 'loading';
    } else if (changesStep) {
      displayText = t('Code changes ready. All work is saved.');
      icon = 'waiting';
    }
  } else {
    overallProgress = calculateAnalysisProgress(autofixData);

    // Set appropriate text/icon based on current step
    if (solutionProcessingStep?.status === AutofixStatus.PROCESSING) {
      displayText = t(
        "Autofix is working hard on a solution. Feel free to leave - it'll continue in the background."
      );
      icon = 'loading';
    } else if (rootCauseProcessingStep?.status === AutofixStatus.PROCESSING) {
      displayText = t(
        "Autofix is working hard on the root cause. Feel free to leave - it'll continue in the background."
      );
      icon = 'loading';
    } else if (solutionStep?.status === AutofixStatus.PROCESSING) {
      displayText = t(
        "Autofix is working hard on a solution. Feel free to leave - it'll continue in the background."
      );
      icon = 'loading';
    } else if (rootCauseStep?.status === AutofixStatus.PROCESSING) {
      displayText = t(
        "Autofix is working hard on the root cause. Feel free to leave - it'll continue in the background."
      );
      icon = 'loading';
    } else if (
      solutionStep &&
      (solutionStep.status === AutofixStatus.COMPLETED || solutionStep.solution_selected)
    ) {
      displayText = t('Found a solution. All work so far is saved.');
      icon = 'waiting';
    } else if (
      rootCauseStep &&
      (rootCauseStep.status === AutofixStatus.COMPLETED || rootCauseStep.selection)
    ) {
      displayText = t('Root cause identified.');
      icon = 'waiting';
    } else if (autofixData.status === AutofixStatus.PROCESSING) {
      // Initial processing, but STILL use calculated progress
      displayText = t('Starting up...');
      icon = 'loading';
      overallProgress = 1;
    }
  }

  if (
    autofixData.status === AutofixStatus.NEED_MORE_INFORMATION ||
    autofixData.status === AutofixStatus.WAITING_FOR_USER_RESPONSE
  ) {
    icon = 'waiting';
  }

  return {
    displayText,
    icon,
    overallProgress,
  };
}
