import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

/**
 * Inline status for an autofix step that stopped part way for credits. The
 * out-of-credits CTA is shown by the credit gates, so this only says what
 * happened.
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

/**
 * Toast for an autofix step the backend refused to start because the
 * organization is out of credits.
 */
export const OUT_OF_CREDITS_START_STEP_MESSAGE: Record<AutofixExplorerStep, string> = {
  root_cause: t(
    "Seer couldn't start on the root cause because your organization is out of credits."
  ),
  solution: t(
    "Seer couldn't start on the plan because your organization is out of credits."
  ),
  code_changes: t(
    "Seer couldn't start on the code changes because your organization is out of credits."
  ),
  pr_iteration: t(
    "Seer couldn't update the pull request because your organization is out of credits."
  ),
};

/**
 * Toast for pull requests the backend refused to open because the
 * organization is out of credits, when the request named no repo.
 */
export const OUT_OF_CREDITS_OPEN_PRS_MESSAGE = t(
  "Seer couldn't open a pull request because your organization is out of credits."
);

export const OUT_OF_CREDITS_CHAT_MESSAGE = t(
  'Seer stopped because your organization is out of credits.'
);

/**
 * Tooltip for a retry that stays disabled until the organization can afford it.
 */
export const OUT_OF_CREDITS_RETRY_TOOLTIP = t(
  'Your organization does not have enough Seer credits for this.'
);

/**
 * Stands in for the backend's `pr_creation_error` on a PR that failed for
 * credits. A PR number means the PR already exists, so the push failed.
 */
export function getOutOfCreditsPRMessage(
  state: Pick<RepoPRState, 'pr_number' | 'repo_name'>
): string {
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
 * One status for every PR in a run that failed for credits, however many repos
 * the run touched.
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
