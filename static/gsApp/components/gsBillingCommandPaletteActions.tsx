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
import {
  hasAccessToSubscriptionOverview,
  shouldShowBillingInformation,
} from 'getsentry/utils/billing';

export function GsBillingCommandPaletteActions() {
  const organization = useOrganization();
  const subscription = useSubscription();

  const prefix = `/settings/${organization.slug}`;
  const canViewSubscription = hasAccessToSubscriptionOverview(subscription, organization);
  const showBillingInformation =
    subscription !== null && shouldShowBillingInformation(subscription, organization);

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
      {showBillingInformation && (
        <CMDKAction
          display={{label: t('Billing Information'), icon: <IconCreditCard />}}
          keywords={[
            'billing',
            'credit card',
            'card',
            'payment method',
            'update credit card',
            'change credit card',
            'update payment method',
            'change payment method',
            'billing details',
            'edit billing information',
            'billing address',
            'billing email',
            'tax',
            'vat',
          ]}
          to={`${prefix}/billing/details/`}
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
