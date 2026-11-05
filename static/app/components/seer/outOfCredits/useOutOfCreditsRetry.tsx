import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  useSeerCreditCheck,
  type SeerCreditOperation,
} from 'sentry/utils/seer/useSeerCreditCheck';

import {OUT_OF_CREDITS_RETRY_TOOLTIP} from './messages';

/**
 * The operation that running an autofix step again spends credits on.
 */
export const AUTOFIX_STEP_CREDIT_OPERATION: Record<
  AutofixExplorerStep,
  SeerCreditOperation
> = {
  root_cause: 'autofix_root_cause',
  solution: 'autofix_solution',
  code_changes: 'autofix_code_changes',
  pr_iteration: 'autofix_pr_iteration',
};

interface UseOutOfCreditsRetryOptions {
  /**
   * The retry is on screen for something that stopped for credits. Nothing is
   * checked otherwise.
   */
  enabled: boolean;
}

/**
 * Gates the retry of a step or PR that stopped because the organization ran
 * out of Seer credits. The retry stays on screen, disabled while the
 * organization can't afford `operation`, and comes back once it can.
 *
 * Fails open like `useSeerCreditCheck`: without `seer-credit-checks` the retry
 * is enabled and the backend decides.
 */
export function useOutOfCreditsRetry(
  operation: SeerCreditOperation,
  {enabled}: UseOutOfCreditsRetryOptions
) {
  const {hasEnoughCredits, isPending} = useSeerCreditCheck(operation, {enabled});

  return {
    // Held back while the check is in flight so it doesn't flash enabled.
    disabled: isPending || !hasEnoughCredits,
    tooltip: hasEnoughCredits ? undefined : OUT_OF_CREDITS_RETRY_TOOLTIP,
  };
}
