import {
  useAutofixCreditCheck,
  type AutofixAction,
} from 'sentry/components/events/autofix/autofixCredits';

import {OUT_OF_CREDITS_RETRY_TOOLTIP} from './messages';

interface UseOutOfCreditsRetryOptions {
  /**
   * The retry is on screen for something that stopped for credits. Nothing is
   * checked otherwise.
   */
  enabled: boolean;
  billingFeature?: number | null;
}

/**
 * Gates the retry of a step or PR that stopped because the organization ran
 * out of Seer credits. The retry stays on screen, disabled while the
 * organization can't afford `action`, and comes back once it can.
 *
 * Fails open like `useSeerCreditCheck`: without `token-billed-seer-enabled` the
 * retry is enabled and the backend decides.
 */
export function useOutOfCreditsRetry(
  action: AutofixAction,
  options: UseOutOfCreditsRetryOptions
) {
  const {disabled, hasEnoughCredits} = useAutofixCreditCheck(action, options);

  return {
    disabled,
    tooltip: hasEnoughCredits ? undefined : OUT_OF_CREDITS_RETRY_TOOLTIP,
  };
}
