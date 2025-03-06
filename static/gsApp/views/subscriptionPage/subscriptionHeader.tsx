import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconCodecov} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {openCodecovModal} from 'getsentry/actionCreators/modal';
import PartnerPlanEndingBanner from 'getsentry/components/partnerPlanEndingBanner';
import type {Subscription} from 'getsentry/types';
import {
  hasAccessToSubscriptionOverview,
  hasPerformance,
  isBizPlanFamily,
} from 'getsentry/utils/billing';
import {isDisabledByPartner} from 'getsentry/utils/partnerships';
import PartnershipNote from 'getsentry/views/subscriptionPage/partnershipNote';

import {HeaderCards} from './headerCards/headerCards';
import DecidePendingChanges from './decidePendingChanges';
import ManagedNote from './managedNote';
import {SubscriptionUpsellBanner} from './subscriptionUpsellBanner';
import TrialAlert from './trialAlert';
import {hasPermissions, hasSpendVisibilityNotificationsFeature} from './utils';

const requireBilling = (organization: Organization, isDisabled: boolean) =>
  hasPermissions(organization, 'org:billing') && !isDisabled;

// The order of the keys here will determine the order tabs in the UI
const tabConfig = [
  {
    key: 'overview',
    name: t('Overview'),
    // always show the overview tab
    show: () => true,
  },
  {
    key: 'usage',
    name: t('Usage History'),
    show: requireBilling,
  },
  {
    key: 'receipts',
    name: t('Receipts'),
    show: requireBilling,
  },
  {
    key: 'notifications',
    name: t('Notifications'),
    show: (organization: Organization, isDisabled: boolean) => {
      return (
        requireBilling(organization, isDisabled) &&
        hasSpendVisibilityNotificationsFeature(organization)
      );
    },
  },
  {
    key: 'details',
    name: t('Billing Details'),
    show: (
      organization: Organization,
      isDisabled: boolean,
      subscription: Subscription
    ) => {
      return requireBilling(organization, isDisabled) && !subscription.isSelfServePartner;
    },
  },
  {
    key: 'usage-log',
    name: t('Usage Log'),
    // always show the usage log tab
    show: () => true,
  },
] as const;

type Props = {
  organization: Organization;
  subscription: Subscription;
};

/**
 * Header and Tab navigation common across subscription views.
 */
function SubscriptionHeader(props: Props) {
  const {subscription, organization} = props;
  const hasBillingPerms = hasPermissions(organization, 'org:billing');
  const isDisabled = isDisabledByPartner(subscription);

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Subscription')} orgSlug={organization.slug} />
      <SubscriptionUpsellBanner organization={organization} subscription={subscription} />
      <SettingsPageHeader
        data-test-id="subscription-page"
        title={t('Subscription')}
        tabs={
          <NavTabs underlined>
            {tabConfig.reduce((acc, {key, name, show}) => {
              if (show(organization, isDisabled, subscription)) {
                acc.push(
                  <ListLink
                    key={key}
                    to={`/settings/${organization.slug}/billing/${key}/`}
                  >
                    {name}
                  </ListLink>
                );
              }
              return acc;
            }, [] as React.ReactNode[])}
          </NavTabs>
        }
        action={
          <ActionContainer>
            {subscription.canSelfServe && hasBillingPerms && (
              <Button
                size="md"
                to={`/settings/${organization.slug}/billing/checkout/?referrer=manage_subscription`}
                aria-label="Manage subscription"
              >
                {t('Manage Subscription')}
              </Button>
            )}
            {hasAccessToSubscriptionOverview(subscription, organization) ? (
              <Button
                size="md"
                icon={<IconCodecov />}
                onClick={() => openCodecovModal({organization})}
              >
                {t('Try Codecov')}
              </Button>
            ) : null}
          </ActionContainer>
        }
        body={
          // Some billing visibility is disabled by partners like billing modification or contract details
          isDisabled ? (
            <PartnershipNote subscription={subscription} />
          ) : hasBillingPerms ? (
            <BodyWithBillingPerms {...props} />
          ) : (
            <BodyWithoutBillingPerms {...props} />
          )
        }
      />
    </Fragment>
  );
}

/**
 * It's important to separate the views for folks with billing permissions (org:billing) and those without.  Only
 * owners and billing admins have the billing scope, everyone else including managers, admins, and members lack that
 * scope.
 */
function BodyWithBillingPerms({organization, subscription}: any) {
  return (
    <Fragment>
      {subscription.pendingChanges ? (
        <DecidePendingChanges subscription={subscription} organization={organization} />
      ) : null}
      <TrialAlert subscription={subscription} organization={organization} />
      {organization.features.includes('partner-billing-migration') && (
        <PartnerPlanEndingBanner
          subscription={subscription}
          organization={organization}
        />
      )}
      <HeaderCards organization={organization} subscription={subscription} />
      <ManagedNote subscription={subscription} />
    </Fragment>
  );
}

function BodyWithoutBillingPerms({organization, subscription}: any) {
  // if a current tier self serve business plan, we have nothing to render in this section
  if (
    isBizPlanFamily(subscription?.planDetails) &&
    hasPerformance(subscription.planDetails) &&
    subscription.canSelfServe
  ) {
    return null;
  }
  return (
    <Fragment>
      <TrialAlert subscription={subscription} organization={organization} />
      <ManagedNote subscription={subscription} />
    </Fragment>
  );
}

export default SubscriptionHeader;

const ActionContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  padding-top: ${space(1)};
`;
