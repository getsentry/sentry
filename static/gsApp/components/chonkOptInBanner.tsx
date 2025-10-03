import {ChonkOptInBannerComponent} from 'sentry/utils/theme/ChonkOptInBanner';

import useSubscription from 'getsentry/hooks/useSubscription';

import {useExceededSubscriptionCategories} from './navBillingStatus';

export function ChonkOptInBanner() {
  const subscription = useSubscription();
  const exceededCategories = useExceededSubscriptionCategories(subscription);

  if (exceededCategories.length > 0) {
    return null;
  }

  return <ChonkOptInBannerComponent collapsed="never" />;
}
