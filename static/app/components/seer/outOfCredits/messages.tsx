import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

/**
 * Headlines for `SeerOutOfCreditsCta` when an autofix step stopped part way.
 * The CTA follows each with what the viewer can do about it.
 */
export const OUT_OF_CREDITS_STEP_MESSAGE: Record<AutofixExplorerStep, string> = {
  root_cause: t(
    'Seer stopped before finishing the root cause because your organization is out of credits.'
  ),
  solution: t(
    'Seer stopped before finishing the plan because your organization is out of credits.'
  ),
  code_changes: t(
    'Seer stopped before finishing the code changes because your organization is out of credits.'
  ),
  pr_iteration: t(
    'Seer stopped before updating the pull request because your organization is out of credits.'
  ),
};

export const OUT_OF_CREDITS_CHAT_MESSAGE = t(
  'Seer stopped because your organization is out of credits.'
);

/**
 * Stands in for the backend's `pr_creation_error` on a PR that failed for
 * credits. A PR number means the PR already exists, so the push failed.
 */
export function getOutOfCreditsPRMessage(state: RepoPRState): string {
  return state.pr_number
    ? t(
        "Seer couldn't push changes to %s#%s because your organization is out of credits.",
        state.repo_name,
        state.pr_number
      )
    : t(
        "Seer couldn't open a pull request in %s because your organization is out of credits.",
        state.repo_name
      );
}

/**
 * One headline for every PR in a run that failed for credits, so a surface
 * shows a single CTA however many repos the run touched.
 */
export function getOutOfCreditsPRsMessage(states: RepoPRState[]): string {
  if (states.length === 1) {
    return getOutOfCreditsPRMessage(states[0]!);
  }
  return t(
    "Seer couldn't finish %s pull requests because your organization is out of credits.",
    states.length
  );
}
