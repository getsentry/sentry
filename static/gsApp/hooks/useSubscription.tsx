import {useSelector} from '@tanstack/react-store';

import {useOrganization} from 'sentry/utils/useOrganization';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

export function useSubscription(): Subscription | null {
  const organization = useOrganization();
  return useSelector(SubscriptionStore.store, state => state[organization.slug]) ?? null;
}
