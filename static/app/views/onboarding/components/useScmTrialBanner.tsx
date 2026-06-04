import {useEffect} from 'react';

import {getOverride} from 'sentry/overrideRegistry';

export type UseScmTrialBannerResult = {
  /**
   * Whether to render the "unlimited volume" trial banner above the feature
   * cards. Only true while the org is on an active trial.
   */
  showTrialBanner: boolean;
  /**
   * Days remaining in the active trial. Drives the banner copy. Only
   * meaningful when `showTrialBanner` is true.
   */
  trialDaysLeft: number;
};

// New-org onboarding always granted a fresh 14-day trial, which is why the
// banner copy was historically hardcoded to 14 days and always shown. The OSS
// fallback preserves that behavior for self-hosted, where there is no billing
// system to consult. The gsApp override refines it from the real subscription.
const FALLBACK_TRIAL_DAYS = 14;

function useFallbackScmTrialBanner(): UseScmTrialBannerResult {
  return {showTrialBanner: false, trialDaysLeft: FALLBACK_TRIAL_DAYS};
}

/**
 * Controls the SCM onboarding "unlimited volume" trial banner.
 *
 * The implementation lives in gsApp; it reads the active org's subscription so
 * the banner only renders during an active trial and reflects the real days
 * remaining. This matters in the SCM-first project-creation flow, where the
 * viewer is an existing org that may be on the free plan, on a paid plan, or
 * partway through a trial — unlike new-org onboarding, which always starts a
 * fresh trial. On self-hosted, where gsApp isn't bundled, the static fallback
 * preserves the historical always-on 14-day banner.
 */
export function useScmTrialBanner(): UseScmTrialBannerResult {
  const override = getOverride('react-hook:use-scm-trial-banner');

  const hasOverride = override ?? false;

  useEffect(() => {
    console.log(
      `useScmTrialBanner, ${hasOverride ? 'using real hook' : 'using fallback'}`
    );
  }, [hasOverride]);

  const hook = override ?? useFallbackScmTrialBanner;
  return hook();
}
