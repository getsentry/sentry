import {useMemo} from 'react';

import {t} from 'sentry/locale';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Scope} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {NavigationProps, NavigationSection} from 'sentry/views/settings/types';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

type NavProps = NavigationProps & {
  access?: Set<Scope>;
};

export function useBillingNavigationConfig(): NavigationSection | null {
  const organization = useOrganization();
  const subscription = useLegacyStore(SubscriptionStore)[organization.slug] ?? null;

  return useMemo(() => {
    if (!subscription) {
      return null;
    }
    return buildBillingNavigationConfig(organization, subscription.canSelfServe);
  }, [organization, subscription]);
}

function buildBillingNavigationConfig(
  organization: Organization,
  membersCanViewSubscriptionInfo: boolean
): NavigationSection {
  const prefix = '/settings/:orgId';

  const items = [
    {
      path: `${prefix}/billing/`,
      title: t('Subscription'),
      show: ({access}: NavProps) =>
        access?.has('org:billing') || membersCanViewSubscriptionInfo,
      id: 'subscription',
    },
    {
      path: `${prefix}/subscription/spend-allocations/`,
      title: t('Spend Allocations'),
      show: () => organization.features.includes('spend-allocations'),
      id: 'spend-allocations',
      description: t('Guarantee monthly event volume to your priority projects.'),
    },
    {
      path: `${prefix}/spike-protection/`,
      title: t('Spike Protection'),
      id: 'spike',
    },
    {
      path: `${prefix}/subscription/redeem-code/`,
      title: t('Redeem Promo Code'),
      id: 'promo',
    },
    {
      path: `${prefix}/legal/`,
      title: t('Legal & Compliance'),
      id: 'legal',
    },
  ];

  return {
    id: 'settings-usage-billing',
    name: t('Usage & Billing'),
    items,
  };
}
