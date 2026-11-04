import {useEffect} from 'react';

import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

interface UseSubscriptionOptions {
  organization?: Organization | null;
}

export function useSubscription(options?: UseSubscriptionOptions): Subscription | null {
  const contextOrganization = useOrganization({allowNull: true});
  const organization = options?.organization ?? contextOrganization;
  const subscriptions = useLegacyStore(SubscriptionStore);
  const slug = organization?.slug;

  useEffect(() => {
    if (slug && !SubscriptionStore.getState()[slug]) {
      SubscriptionStore.loadData(slug);
    }
  }, [slug]);

  return slug ? (subscriptions[slug] ?? null) : null;
}
