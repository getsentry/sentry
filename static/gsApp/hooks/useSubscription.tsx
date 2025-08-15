import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useOrganization from 'sentry/utils/useOrganization';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

export default function useSubscription(): Subscription | null {
  const organization = useOrganization();
  return useLegacyStore(SubscriptionStore)[organization.slug] ?? null;
}
