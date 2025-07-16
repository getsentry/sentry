import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import OnDemandBudgetEditModal from 'getsentry/views/onDemandBudgets/onDemandBudgetEditModal';

interface UpgradeCTAProps {
  hasBillingAccess: boolean;
}

export function CronsBannerUpgradeCTA({hasBillingAccess}: UpgradeCTAProps) {
  const organization = useOrganization();
  const api = useApi();

  // Check if subscription is self-serve
  const subscription = SubscriptionStore.getState()[organization.slug];
  const canSelfServe = subscription?.canSelfServe !== false; // Default to true if unknown

  if (hasBillingAccess) {
    return (
      <LinkButton
        href={normalizeUrl(`/settings/${organization.slug}/billing/checkout/`)}
        size="xs"
        analyticsEventName="Crons: Clicked Trial Banner CTA"
        analyticsEventKey="crons.clicked_trial_banner_cta"
        analyticsParams={{hasBillingAccess, organization}}
      >
        {t('Upgrade Now')}
      </LinkButton>
    );
  }

  // Don't show request upgrade button for non-self-serve or managed plans
  if (!canSelfServe || subscription?.isManaged) {
    return null;
  }

  return (
    <Button
      onClick={() => {
        sendUpgradeRequest({api, organization});
      }}
      size="xs"
      analyticsEventName="Crons: Clicked Trial Banner CTA"
      analyticsEventKey="crons.clicked_trial_banner_cta"
      analyticsParams={{hasBillingAccess, organization}}
    >
      {t('Request Upgrade')}
    </Button>
  );
}

interface OnDemandCTAProps {
  hasBillingAccess: boolean;
  subscription: Subscription;
}

export function CronsBannerOnDemandCTA({
  hasBillingAccess,
  subscription,
}: OnDemandCTAProps) {
  const organization = useOrganization();

  const openOnDemandBudgetEditModal = () => {
    openModal(
      modalProps => (
        <OnDemandBudgetEditModal
          {...modalProps}
          subscription={subscription}
          organization={organization}
        />
      ),
      {
        closeEvents: 'escape-key',
      }
    );
  };

  // Only allow owners, billing roles to edit on demand spend
  if (hasBillingAccess) {
    return (
      <Button
        size="xs"
        onClick={openOnDemandBudgetEditModal}
        analyticsEventName="Crons: Clicked On Demand Banner CTA"
        analyticsEventKey="crons.clicked_on_demand_banner_cta"
        analyticsParams={{hasBillingAccess, organization}}
      >
        {t('Update Plan')}
      </Button>
    );
  }

  return null;
}
