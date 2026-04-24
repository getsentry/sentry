import {Fragment} from 'react';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {IconCreditCard, IconDocs, IconGraph, IconLightning, IconTag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useSubscription} from 'getsentry/hooks/useSubscription';

export function GsBillingCommandPaletteActions() {
  const organization = useOrganization();
  const subscription = useSubscription();

  const prefix = `/settings/${organization.slug}`;
  const canViewSubscription =
    organization.access.includes('org:billing') || (subscription?.canSelfServe ?? false);

  return (
    <Fragment>
      {canViewSubscription && (
        <CMDKAction
          display={{label: t('Subscription'), icon: <IconCreditCard />}}
          keywords={['billing', 'plan', 'usage', 'invoice', 'payment']}
          to={`${prefix}/billing/`}
        />
      )}
      {organization.features.includes('spend-allocations') && (
        <CMDKAction
          display={{label: t('Spend Allocations'), icon: <IconGraph />}}
          keywords={['budget', 'quota', 'projects', 'billing']}
          to={`${prefix}/subscription/spend-allocations/`}
        />
      )}
      <CMDKAction
        display={{label: t('Spike Protection'), icon: <IconLightning />}}
        keywords={['billing', 'quota', 'overage', 'limits']}
        to={`${prefix}/spike-protection/`}
      />
      <CMDKAction
        display={{label: t('Redeem Promo Code'), icon: <IconTag />}}
        keywords={['coupon', 'discount', 'promotional', 'billing']}
        to={`${prefix}/subscription/redeem-code/`}
      />
      <CMDKAction
        display={{label: t('Legal & Compliance'), icon: <IconDocs />}}
        keywords={['terms', 'privacy', 'gdpr', 'dpa', 'billing']}
        to={`${prefix}/legal/`}
      />
    </Fragment>
  );
}
