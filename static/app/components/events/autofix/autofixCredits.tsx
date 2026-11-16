import {
  SeerOutOfCreditsCta,
  type SeerOutOfCreditsReason,
} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {defined} from 'sentry/utils/defined';
import {
  useSeerCreditCheck,
  type SeerCreditOperation,
} from 'sentry/utils/seer/useSeerCreditCheck';

import {getAutofixNextStep, type AutofixNextStep} from './getAutofixNextStep';
import {
  getAutofixArtifactFromSection,
  isPullRequestsSection,
  isSingleRunAutofix,
  type AutofixSection,
  type ExplorerAutofixState,
} from './useExplorerAutofix';

type AutofixAction = AutofixNextStep['action'];

const AUTOFIX_CREDIT_OPERATIONS: Record<AutofixAction, SeerCreditOperation> = {
  root_cause: 'autofix_root_cause',
  solution: 'autofix_solution',
  code_changes: 'autofix_code_changes',
  create_pr: 'autofix_open_pr',
  pr_iteration: 'autofix_pr_iteration',
};

/**
 * Whether the organization can afford the autofix action a surface is about to
 * offer. Without an action nothing is offered, so nothing is checked.
 */
export function useAutofixCreditCheck(
  action: AutofixAction | null | undefined,
  {enabled = true}: {enabled?: boolean} = {}
) {
  return useSeerCreditCheck(AUTOFIX_CREDIT_OPERATIONS[action ?? 'root_cause'], {
    enabled: enabled && defined(action),
  });
}

/**
 * Whether an autofix trigger has to stay disabled for credits: until this
 * mount's check answers, so it is never clickable before the answer arrives,
 * and once the organization can't afford it. A cached answer from an earlier
 * mount doesn't count, since credits can run out in between.
 */
export function useAutofixCreditsDisabled(
  action: AutofixAction | null | undefined,
  options?: {enabled?: boolean}
): boolean {
  const {hasCheckedSinceMount, hasEnoughCredits} = useAutofixCreditCheck(action, options);
  return !hasCheckedSinceMount || !hasEnoughCredits;
}

interface GetAutofixContinueActionOptions {
  isPolling: boolean;
  runState: ExplorerAutofixState | null;
  sections: AutofixSection[];
}

/**
 * The billable action a run with results would take next: what its next-step
 * prompt offers, or the retry of a step or PR create that failed. Null while a
 * step is running or waiting on the reader, since nothing is offered then.
 */
export function getAutofixContinueAction({
  isPolling,
  runState,
  sections,
}: GetAutofixContinueActionOptions): AutofixAction | null {
  const section = sections.at(-1);
  const nextStep = getAutofixNextStep({sections, runState});

  // A single run offers no next step; its only follow-up is opening the chat.
  if (!defined(section) || isSingleRunAutofix(runState)) {
    return null;
  }

  // An open PR takes feedback even while a run is going, and a failed create is
  // retried with another create.
  if (isPullRequestsSection(section)) {
    if (!defined(nextStep)) {
      return 'create_pr';
    }
    return 'pr_iteration';
  }

  if (!defined(nextStep) || isPolling || runState?.status === 'awaiting_user_input') {
    return null;
  }

  // A finished step with nothing to show has no next step to offer either.
  if (
    section.status === 'completed' &&
    !defined(getAutofixArtifactFromSection(section))
  ) {
    return null;
  }

  return nextStep.action;
}

interface AutofixOutOfCreditsAlertProps {
  /**
   * The action the surface offers next. Nothing is checked without one.
   */
  action: AutofixAction | null;
  reason: SeerOutOfCreditsReason;
}

/**
 * The single out-of-credits alert for a surface that shows a whole run. It
 * waits for the check to say the organization is short, so it never flashes up
 * for an org that can pay.
 */
export function AutofixOutOfCreditsAlert({
  action,
  reason,
}: AutofixOutOfCreditsAlertProps) {
  const {hasEnoughCredits, denialReason} = useAutofixCreditCheck(action);

  if (hasEnoughCredits) {
    return null;
  }

  return <SeerOutOfCreditsCta reason={reason} denialReason={denialReason} />;
}
