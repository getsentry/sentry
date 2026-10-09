import {Fragment} from 'react';
import {IconCreditCard} from '@sentry/icons/creditCard';
import {IconDocs} from '@sentry/icons/docs';
import {IconGraph} from '@sentry/icons/graph';
import {IconLightning} from '@sentry/icons/lightning';
import {IconTag} from '@sentry/icons/tag';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
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
          keywords={[
            'billing',
            'plan',
            'change plan',
            'usage',
            'invoice',
            'payment',
            'upgrade',
            'downgrade',
            'pricing',
            'receipts',
          ]}
          to={`${prefix}/billing/`}
        />
      )}
      {organization.features.includes('spend-allocations') && (
        <CMDKAction
          display={{label: t('Spend Allocations'), icon: <IconGraph />}}
          keywords={[
            'budget',
            'quota',
            'projects',
            'billing',
            'allocation',
            'cap',
            'cost',
            'per-project',
          ]}
          to={`${prefix}/subscription/spend-allocations/`}
        />
      )}
      <CMDKAction
        display={{label: t('Spike Protection'), icon: <IconLightning />}}
        keywords={[
          'billing',
          'quota',
          'overage',
          'limits',
          'throttle',
          'ingest',
          'burst',
          'drop',
        ]}
        to={`${prefix}/spike-protection/`}
      />
      <CMDKAction
        display={{label: t('Redeem Promo Code'), icon: <IconTag />}}
        keywords={['coupon', 'discount', 'promotional', 'billing', 'voucher', 'offer']}
        to={`${prefix}/subscription/redeem-code/`}
      />
      <CMDKAction
        display={{label: t('Legal & Compliance'), icon: <IconDocs />}}
        keywords={['terms', 'privacy', 'gdpr', 'dpa', 'tos', 'ccpa', 'soc2']}
        to={`${prefix}/legal/`}
      />
    </Fragment>
  );
}
