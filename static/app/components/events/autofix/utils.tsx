import {formatRootCauseText} from 'sentry/components/events/autofix/autofixRootCause';
import {formatSolutionText} from 'sentry/components/events/autofix/autofixSolution';
import {
  AUTOFIX_TTL_IN_DAYS,
  AutofixStatus,
  AutofixStepType,
  type AutofixCodebaseChange,
  type AutofixData,
  type AutofixRootCauseData,
  type AutofixSolutionTimelineEvent,
} from 'sentry/components/events/autofix/types';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {formatEventToMarkdown} from 'sentry/views/issueDetails/streamline/hooks/useCopyIssueDetails';

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

export function formatRootCauseWithEvent(
  cause: AutofixRootCauseData | undefined,
  customRootCause: string | undefined,
  event: Event | undefined
): string {
  const rootCauseText = formatRootCauseText(cause, customRootCause);

  if (!event) {
    return rootCauseText;
  }

  const eventText = '\n# Raw Event Data\n' + formatEventToMarkdown(event, undefined);
  return rootCauseText + eventText;
}

export function formatSolutionWithEvent(
  solution: AutofixSolutionTimelineEvent[] | undefined,
  customSolution: string | undefined,
  event: Event | undefined,
  rootCause?: AutofixRootCauseData
): string {
  let combinedText = '';

  if (rootCause) {
    const rootCauseText = formatRootCauseText(rootCause);
    combinedText += rootCauseText + '\n\n';
  }

  const solutionText = formatSolutionText(solution || [], customSolution);
  combinedText += solutionText;

  if (event) {
    const eventText = '\n# Raw Event Data\n' + formatEventToMarkdown(event, undefined);
    combinedText += eventText;
  }

  return combinedText;
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

export function hasPullRequest(autofixData: AutofixData | null | undefined): boolean {
  if (!autofixData) {
    return false;
  }

  const changesStep = autofixData.steps?.find(
    step => step.type === AutofixStepType.CHANGES
  );

  return Boolean(changesStep?.changes?.some(change => change.pull_request));
}

const supportedProviders = [
  'github',
  'integrations:github',
  'integrations:github_enterprise',
];
export const isSupportedAutofixProvider = (provider: {id: string; name: string}) => {
  return supportedProviders.includes(provider.id);
};

export interface AutofixProgressDetails {
  overallProgress: number;
}

export function getAutofixProgressDetails(
  autofixData?: AutofixData
): AutofixProgressDetails {
  if (!autofixData) {
    return {overallProgress: 0};
  }

  const steps = autofixData.steps ?? [];

  if (autofixData.status === AutofixStatus.COMPLETED) {
    return {overallProgress: 100};
  }

  if (
    autofixData.status === AutofixStatus.ERROR ||
    autofixData.status === AutofixStatus.CANCELLED
  ) {
    return {overallProgress: 0};
  }

  const processingSteps = steps.filter(step => step.status === AutofixStatus.PROCESSING);
  const lastProcessingStep = processingSteps[processingSteps.length - 1];

  if (!lastProcessingStep) {
    return {overallProgress: 0};
  }

  const progressCount = lastProcessingStep.progress?.length || 0;
  // Increment by 8% per progress log, max 97%
  const progress = Math.min(progressCount * 8, 97);

  return {
    overallProgress: progress,
  };
}

export function getAutofixRunExists(group: Group) {
  const autofixLastRunAsDate = group.seerAutofixLastTriggered
    ? new Date(group.seerAutofixLastTriggered)
    : null;
  const autofixRanWithinTtl = autofixLastRunAsDate
    ? autofixLastRunAsDate >
      new Date(Date.now() - AUTOFIX_TTL_IN_DAYS * 24 * 60 * 60 * 1000)
    : false;

  return autofixRanWithinTtl;
}

export function isIssueQuickFixable(group: Group) {
  return group.seerFixabilityScore && group.seerFixabilityScore > 0.7;
}

export function getAutofixRunErrorMessage(autofixData: AutofixData | undefined) {
  if (!autofixData || autofixData.status !== AutofixStatus.ERROR) {
    return null;
  }

  const errorStep = autofixData.steps?.find(step => step.status === AutofixStatus.ERROR);
  const errorMessage = errorStep?.completedMessage || t('Something went wrong.');

  let customErrorMessage = '';
  if (
    errorMessage.toLowerCase().includes('overloaded') ||
    errorMessage.toLowerCase().includes('no completion tokens') ||
    errorMessage.toLowerCase().includes('exhausted')
  ) {
    customErrorMessage = t(
      'The robots are having a moment. Our LLM provider is overloaded - please try again soon.'
    );
  } else if (
    errorMessage.toLowerCase().includes('prompt') ||
    errorMessage.toLowerCase().includes('tokens')
  ) {
    customErrorMessage = t(
      "Seer worked so hard that it couldn't fit all its findings in its own memory. Please try again."
    );
  } else if (errorMessage.toLowerCase().includes('iterations')) {
    customErrorMessage = t(
      'Seer was taking a ton of iterations, so we pulled the plug out of fear it might go rogue. Please try again.'
    );
  } else if (errorMessage.toLowerCase().includes('timeout')) {
    customErrorMessage = t(
      'Seer was taking way too long, so we pulled the plug to turn it off and on again. Please try again.'
    );
  } else {
    customErrorMessage = t(
      "Oops, Seer went kaput. We've dispatched Seer to fix Seer. In the meantime, try again?"
    );
  }

  return customErrorMessage;
}
