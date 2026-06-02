import {useEffect} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';
import type {UseScmTrialBannerResult} from 'sentry/views/onboarding/components/useScmTrialBanner';

import {useSubscription} from 'getsentry/hooks/useSubscription';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {getTrialDaysLeft} from 'getsentry/utils/billing';

/**
 * gsApp implementation of `useScmTrialBanner`. Gates the SCM onboarding trial
 * banner on an active trial and reports the real days remaining.
 *
 * New-org onboarding always starts a fresh trial, so the banner shows there as
 * before. In the SCM-first project-creation flow the viewer is an existing org:
 * the banner only renders while that org is genuinely trialing, and stays hidden
 * for free and paid orgs (for whom the "unlimited volume for N days" copy would
 * be wrong).
 */
export function useScmTrialBanner(): UseScmTrialBannerResult {
  const organization = useOrganization();
  const subscription = useSubscription();

  // The onboarding and project-creation hosts are OSS views that aren't wrapped
  // in `withSubscription`, so make sure the subscription is loaded. `get` is a
  // no-op when it is already cached.
  useEffect(() => {
    SubscriptionStore.get(organization.slug, () => {});
  }, [organization.slug]);

  const isTrial = !!subscription?.isTrial;

  return {
    showTrialBanner: isTrial,
    trialDaysLeft: isTrial ? Math.max(getTrialDaysLeft(subscription), 0) : 0,
  };
}
