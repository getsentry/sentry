import {Fragment} from 'react';
import {useLocation} from 'react-router-dom';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconCodecov} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
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
  const location = useLocation();

  const tab = location.pathname.split('/').at(-2);
  const activeTab = tabConfig.find(({key}) => key === tab) ?? tabConfig[0];

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Subscription')} orgSlug={organization.slug} />
      <SubscriptionUpsellBanner organization={organization} subscription={subscription} />
      <SettingsPageHeader
        data-test-id="subscription-page"
        title={t('Subscription')}
        tabs={
          <TabsContainer>
            <Tabs value={activeTab.key}>
              <TabList>
                {tabConfig
                  .map(({key, name, show}) => {
                    if (show(organization, isDisabled, subscription)) {
                      return (
                        <TabList.Item
                          key={key}
                          to={normalizeUrl(
                            `/settings/${organization.slug}/billing/${key}/`
                          )}
                        >
                          {name}
                        </TabList.Item>
                      );
                    }
                    return null;
                  })
                  .filter(n => !!n)}
              </TabList>
            </Tabs>
          </TabsContainer>
        }
        action={
          <ActionContainer>
            {subscription.canSelfServe && hasBillingPerms && (
              <LinkButton
                size="md" redesign
                to={`/settings/${organization.slug}/billing/checkout/?referrer=manage_subscription`}
                aria-label="Manage subscription"
              >
                {t('Manage Subscription')}
              </LinkButton>
            )}
            {hasAccessToSubscriptionOverview(subscription, organization) ? (
              <Button
                size="md" redesign
                icon={<IconCodecov redesign />}
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

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

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
