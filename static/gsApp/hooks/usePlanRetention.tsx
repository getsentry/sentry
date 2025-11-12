import type {DataCategory} from 'sentry/types/core';
import useOrganization from 'sentry/utils/useOrganization';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';

export default function usePlanRetention():
  | Partial<Record<DataCategory, {downsampled: number | null; standard: number}>>
  | undefined {
  const organization = useOrganization();
  const subscription = SubscriptionStore.getState()[organization.slug];
  return subscription?.planDetails.retentions;
}
