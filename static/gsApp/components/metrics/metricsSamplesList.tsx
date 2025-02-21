import {Fragment, useMemo} from 'react';
import type {LocationDescriptor} from 'history';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openAM2ProfilingUpsellModal} from 'getsentry/actionCreators/modal';
import {
  makeLinkToManageSubscription,
  makeLinkToOwnersAndBillingMembers,
} from 'getsentry/components/profiling/alerts';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

const INSUFFICIENT_PLAN_TIERS = new Set([PlanTier.AM1, PlanTier.MM2, PlanTier.MM1]);

interface MetricsSamplesListProps {
  children: React.ReactNode;
  organization: Organization;
  subscription: Subscription;
}

function MetricsSamplesList({
  children,
  organization,
  subscription,
}: MetricsSamplesListProps) {
  const upgradeAction = useMemo(
    () => getUpgradeAction(organization, subscription),
    [organization, subscription]
  );

  if (upgradeAction) {
    const {label, to, onClick} = upgradeAction;
    return (
      <Alert
        showIcon
        icon={<IconWarning />}
        type="warning"
        trailingItems={[
          <Button key="upgrade" size="xs" to={to} onClick={onClick}>
            {label}
          </Button>,
        ]}
      >
        {t(
          'The sampled events feature is not available on your current plan. To access it, update to the latest version of your plan.'
        )}
      </Alert>
    );
  }
  return <Fragment>{children}</Fragment>;
}

function getUpgradeAction(
  organization: Organization,
  subscription: Subscription
): {
  label: React.ReactNode;
  onClick?: () => void;
  to?: LocationDescriptor;
} | null {
  if (!INSUFFICIENT_PLAN_TIERS.has(subscription.planTier as PlanTier)) {
    return null;
  }

  const userCanUpgrade = organization.access?.includes('org:billing');

  if (subscription.canSelfServe) {
    if (userCanUpgrade) {
      return {
        label: t('Update Plan'),
        onClick: () => {
          openAM2ProfilingUpsellModal({
            organization,
            subscription,
          });
          trackOpenModal(organization, subscription);
        },
      };
    }
    return {
      label: t('See who can update'),
      to: makeLinkToOwnersAndBillingMembers(organization, 'ddm-samples_list'),
      onClick: () => {
        trackManageSubscriptionClicked(organization, subscription);
      },
    };
  }
  return {
    label: t('Manage Subscription'),
    to: makeLinkToManageSubscription(organization, 'ddm-samples_list'),
    onClick: () => {
      trackManageSubscriptionClicked(organization, subscription);
    },
  };
}

function makeAnalyticsProps(organization: Organization, subscription: Subscription) {
  return {
    organization,
    surface: 'metrics' as const,
    planTier: subscription.planTier,
    canSelfServe: subscription.canSelfServe,
    channel: subscription.channel,
    has_billing_scope: organization.access?.includes('org:billing'),
  };
}

function trackOpenModal(organization: Organization, subscription: Subscription) {
  trackGetsentryAnalytics(
    'upgrade_now.alert.open_modal',
    makeAnalyticsProps(organization, subscription)
  );
}

function trackManageSubscriptionClicked(
  organization: Organization,
  subscription: Subscription
) {
  trackGetsentryAnalytics(
    'upgrade_now.alert.manage_sub',
    makeAnalyticsProps(organization, subscription)
  );
}

export default withSubscription(MetricsSamplesList, {noLoader: true});
