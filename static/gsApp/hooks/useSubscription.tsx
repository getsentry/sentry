import {useEffect} from 'react';
import {useStore} from 'zustand';

import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

export function useSubscription({
  organization: organizationOverride,
}: {organization?: Organization} = {}): Subscription | null {
  const contextOrganization = useOrganization({allowNull: true});
  const slug = (organizationOverride ?? contextOrganization)?.slug;

  useEffect(() => {
    if (slug && !SubscriptionStore.getState()[slug]) {
      SubscriptionStore.loadData(slug);
    }
  }, [slug]);

  return useStore(SubscriptionStore, state => (slug ? (state[slug] ?? null) : null));
}
