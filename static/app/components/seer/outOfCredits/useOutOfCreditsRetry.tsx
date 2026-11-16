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
}

/**
 * Gates the retry of a step or PR that stopped because the organization ran
 * out of Seer credits. The retry stays on screen, disabled while the
 * organization can't afford `action`, and comes back once it can.
 *
 * Fails open like `useSeerCreditCheck`: without `seer-credit-checks` the retry
 * is enabled and the backend decides.
 */
export function useOutOfCreditsRetry(
  action: AutofixAction,
  {enabled}: UseOutOfCreditsRetryOptions
) {
  const {disabled, hasEnoughCredits} = useAutofixCreditCheck(action, {enabled});

  return {
    disabled,
    tooltip: hasEnoughCredits ? undefined : OUT_OF_CREDITS_RETRY_TOOLTIP,
  };
}
