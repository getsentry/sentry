import useOrganization from 'sentry/utils/useOrganization';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';

export default function useGetMaxRetentionDays(): number | undefined {
  const organization = useOrganization();
  const subscription = SubscriptionStore.getState()[organization.slug];
  return subscription?.planDetails?.retentionDays;
}
