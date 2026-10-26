import {isCreatedPullRequestState} from 'sentry/components/events/autofix/pullRequests';
import {
  getAutofixArtifactFromSection,
  isCodeChangesSection,
  isPullRequestsArtifact,
  isPullRequestsSection,
  isRootCauseSection,
  isSolutionSection,
  type AutofixSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {defined} from 'sentry/utils/defined';

export type AutofixNextStep =
  | {action: 'root_cause'; section: AutofixSection}
  | {action: 'solution'; section: AutofixSection}
  | {action: 'code_changes'; section: AutofixSection}
  | {action: 'create_pr'; section: AutofixSection}
  | {action: 'pr_iteration'; section: AutofixSection};

interface GetAutofixNextStepOptions {
  sections: AutofixSection[];
}

/**
 * For a given list of Autofix sections, return the next action to be taken.
 * Takes completion status into account (the next step does not change until the current section is completed)
 *
 * If the most recent section is a completed root cause section, returns `solution`.
 * If the most recent section is an in-progress root cause section, returns `root_cause`.
 */
export function getAutofixNextStep({
  sections,
}: GetAutofixNextStepOptions): AutofixNextStep | null {
  const section = sections.at(-1);

  if (!defined(section)) {
    return null;
  }

  if (isPullRequestsSection(section)) {
    const artifact = getAutofixArtifactFromSection(section);
    if (isPullRequestsArtifact(artifact) && !artifact.some(isCreatedPullRequestState)) {
      return null;
    }
    return {action: 'pr_iteration', section};
  }

  const isCompleted = section.status === 'completed';

  if (isRootCauseSection(section)) {
    return {action: isCompleted ? 'solution' : 'root_cause', section};
  }

  if (isSolutionSection(section)) {
    return {action: isCompleted ? 'code_changes' : 'solution', section};
  }

  if (isCodeChangesSection(section)) {
    return {action: isCompleted ? 'create_pr' : 'code_changes', section};
  }

  return null;
}
