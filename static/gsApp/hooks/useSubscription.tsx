import {useEffect} from 'react';

import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

export function useSubscription({
  organization: organizationOverride,
}: {organization?: Organization} = {}): Subscription | null {
  const contextOrganization = useOrganization({allowNull: true});
  const organization = organizationOverride ?? contextOrganization;
  const subscriptions = useLegacyStore(SubscriptionStore);
  const slug = organization?.slug;

  useEffect(() => {
    if (slug && !SubscriptionStore.getState()[slug]) {
      SubscriptionStore.loadData(slug);
    }
  }, [slug]);

  return slug ? (subscriptions[slug] ?? null) : null;
}
