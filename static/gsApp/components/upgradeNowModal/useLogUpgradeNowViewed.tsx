import {useEffect} from 'react';

import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import trackGetsentryAnalytics, {
  type AM2UpdateSurfaces,
} from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  hasPriceChange: boolean;
  organization: Organization;
  subscription: Subscription;
  surface: AM2UpdateSurfaces;
};

export default function useLogUpgradeNowViewed({
  hasPriceChange,
  organization,
  subscription,
  surface,
}: Props) {
  useEffect(() => {
    trackGetsentryAnalytics('upgrade_now.modal.viewed', {
      organization,
      planTier: subscription.planTier,
      canSelfServe: subscription.canSelfServe,
      channel: subscription.channel,
      has_billing_scope: organization.access?.includes('org:billing'),
      surface,
      has_price_change: hasPriceChange,
    });
  }, [hasPriceChange, organization, subscription, surface]);
}
