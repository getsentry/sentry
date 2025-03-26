import {formatRootCauseText} from 'sentry/components/events/autofix/autofixRootCause';
import {formatSolutionText} from 'sentry/components/events/autofix/autofixSolution';
import {
  type AutofixChangesStep,
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
  ) as AutofixChangesStep | undefined;

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
