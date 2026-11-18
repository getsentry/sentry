import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t, tn} from 'sentry/locale';
import type {SeerCreditDenialReason} from 'sentry/utils/seer/useSeerCreditCheck';
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

const OUT_OF_CREDITS_START_STEP_MESSAGE: Record<AutofixExplorerStep, string> = {
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
    "Seer couldn't start on this feedback because your organization is out of credits. Seer continues the next time it iterates on the pull request."
  ),
};

const DAILY_LIMIT_START_STEP_MESSAGE: Record<AutofixExplorerStep, string> = {
  root_cause: t(
    "Seer couldn't start on the root cause because your organization hit its daily usage limit."
  ),
  solution: t(
    "Seer couldn't start on the plan because your organization hit its daily usage limit."
  ),
  code_changes: t(
    "Seer couldn't start on the code changes because your organization hit its daily usage limit."
  ),
  pr_iteration: t(
    "Seer couldn't start on this feedback because your organization hit its daily usage limit. Seer continues the next time it iterates on the pull request."
  ),
};

/**
 * Toast for an autofix step the backend refused to start for credits. The
 * 402's `denialReason` tells a daily usage limit apart from running out.
 */
export function getRefusedStepMessage(
  step: AutofixExplorerStep,
  denialReason: SeerCreditDenialReason | null
): string {
  return denialReason === 'daily_cap_exceeded'
    ? DAILY_LIMIT_START_STEP_MESSAGE[step]
    : OUT_OF_CREDITS_START_STEP_MESSAGE[step];
}

// TODO(CW-3102): Point at the Retry button instead of the next iteration.
const OUT_OF_CREDITS_PR_ITERATION_MESSAGE = {
  push: t(
    "Seer couldn't push the latest changes because your organization is out of credits. Seer continues the next time it iterates on the pull request."
  ),
  branch_moved_retry: t(
    "Seer couldn't redo the latest changes on the pull request's newer commits because your organization is out of credits. Seer continues the next time it iterates on the pull request."
  ),
  queued: (count: number) =>
    tn(
      "Seer couldn't start on %s feedback item because your organization is out of credits. Seer continues the next time it iterates on the pull request.",
      "Seer couldn't start on %s feedback items because your organization is out of credits. Seer continues the next time it iterates on the pull request.",
      count
    ),
};

const DAILY_LIMIT_PR_ITERATION_MESSAGE = {
  push: t(
    "Seer couldn't push the latest changes because your organization hit its daily usage limit. Seer continues the next time it iterates on the pull request."
  ),
  branch_moved_retry: t(
    "Seer couldn't redo the latest changes on the pull request's newer commits because your organization hit its daily usage limit. Seer continues the next time it iterates on the pull request."
  ),
  queued: (count: number) =>
    tn(
      "Seer couldn't start on %s feedback item because your organization hit its daily usage limit. Seer continues the next time it iterates on the pull request.",
      "Seer couldn't start on %s feedback items because your organization hit its daily usage limit. Seer continues the next time it iterates on the pull request.",
      count
    ),
};

/**
 * The Code Changes card's line for PR iteration work waiting for credits.
 */
export function getPrIterationOutOfCreditsMessage(
  waitingAction: 'push' | 'branch_moved_retry' | null,
  queuedCount: number,
  denialReason: SeerCreditDenialReason | null
): string | null {
  const messages =
    denialReason === 'daily_cap_exceeded'
      ? DAILY_LIMIT_PR_ITERATION_MESSAGE
      : OUT_OF_CREDITS_PR_ITERATION_MESSAGE;
  if (waitingAction) {
    return messages[waitingAction];
  }
  return queuedCount ? messages.queued(queuedCount) : null;
}

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
 * Toast for a pull request the backend refused to open or push for credits,
 * with the 402's `denialReason`. Without a repo, the request was for every
 * repo in the run.
 */
export function getRefusedPRMessage(
  state: Pick<RepoPRState, 'pr_number' | 'repo_name'> | undefined,
  denialReason: SeerCreditDenialReason | null
): string {
  if (denialReason !== 'daily_cap_exceeded') {
    return state
      ? getOutOfCreditsPRMessage(state)
      : t(
          "Seer couldn't open a pull request because your organization is out of credits."
        );
  }
  if (!state) {
    return t(
      "Seer couldn't open a pull request because your organization hit its daily usage limit."
    );
  }
  return state.pr_number
    ? t(
        "Seer couldn't push changes to %s#%s because your organization hit its daily usage limit.",
        state.repo_name,
        state.pr_number
      )
    : t(
        "Seer couldn't open a pull request in %s because your organization hit its daily usage limit.",
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
