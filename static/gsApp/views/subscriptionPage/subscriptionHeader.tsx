import {cloneElement, Fragment, isValidElement} from 'react';
import {useLocation} from 'react-router-dom';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {Heading, Text} from 'sentry/components/core/text';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconCodecov} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {openCodecovModal} from 'getsentry/actionCreators/modal';
import PartnerPlanEndingBanner from 'getsentry/components/partnerPlanEndingBanner';
import type {Subscription} from 'getsentry/types';
import {
  getPlanIcon,
  hasAccessToSubscriptionOverview,
  hasNewBillingUI,
  hasPartnerMigrationFeature,
} from 'getsentry/utils/billing';
import {isDisabledByPartner} from 'getsentry/utils/partnerships';
import PartnershipNote from 'getsentry/views/subscriptionPage/partnershipNote';

import HeaderCards from './headerCards/headerCards';
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
  const isNewBillingUI = hasNewBillingUI(organization);

  const tab = location.pathname.split('/').at(-2);
  const activeTab = tabConfig.find(({key}) => key === tab) ?? tabConfig[0];

  const planIcon = getPlanIcon(subscription.planDetails);

  if (!isNewBillingUI) {
    return (
      <Fragment>
        <SentryDocumentTitle title={t('Subscription')} orgSlug={organization.slug} />
        <SubscriptionUpsellBanner
          organization={organization}
          subscription={subscription}
        />
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
                  size="md"
                  to={`/checkout/${organization.slug}/?referrer=manage_subscription`}
                  aria-label="Manage subscription"
                >
                  {t('Manage Subscription')}
                </LinkButton>
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

  return (
    <Flex direction="column" gap="xl" background="secondary">
      <SentryDocumentTitle title={t('Subscription')} orgSlug={organization.slug} />

      <Flex
        direction="column"
        gap="md"
        background="primary"
        borderBottom="primary"
        padding="md 3xl 2xl"
      >
        <Heading as="h1" size="md">
          {t('Subscription')}
        </Heading>
        <Flex
          justify="between"
          align={{xs: 'start', sm: 'center'}}
          direction={{xs: 'column', sm: 'row'}}
          gap="xl"
        >
          <Flex align="center" gap="sm">
            {isValidElement(planIcon)
              ? cloneElement(planIcon, {size: 'md'} as SVGIconProps)
              : null}
            <Text size="2xl" bold>
              {tct('[planName] plan', {planName: subscription.planDetails.name})}
            </Text>
          </Flex>
          <Flex gap="md">
            {subscription.canSelfServe && hasBillingPerms && (
              <LinkButton
                size="md"
                to={`/checkout/${organization.slug}/?referrer=manage_subscription`}
                aria-label="Manage plan"
                priority="primary"
              >
                {t('Manage plan')}
              </LinkButton>
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
          </Flex>
        </Flex>
      </Flex>
      <Flex direction="column" padding="0 2xl xl" gap="xl" borderBottom="primary">
        <SubscriptionUpsellBanner
          organization={organization}
          subscription={subscription}
        />
        {isDisabled ? (
          <PartnershipNote subscription={subscription} />
        ) : hasBillingPerms ? (
          <BodyWithBillingPerms {...props} />
        ) : (
          <BodyWithoutBillingPerms {...props} />
        )}
      </Flex>
    </Flex>
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
function BodyWithBillingPerms({
  organization,
  subscription,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  return (
    <Flex direction="column" gap="xl">
      {subscription.pendingChanges ? (
        <DecidePendingChanges subscription={subscription} organization={organization} />
      ) : null}
      <TrialAlert subscription={subscription} organization={organization} />
      {hasPartnerMigrationFeature(organization) && (
        <PartnerPlanEndingBanner
          subscription={subscription}
          organization={organization}
        />
      )}
      <HeaderCards organization={organization} subscription={subscription} />
      <ManagedNote subscription={subscription} />
    </Flex>
  );
}

function BodyWithoutBillingPerms({
  organization,
  subscription,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const isNewBillingUI = hasNewBillingUI(organization);
  return (
    <Fragment>
      <TrialAlert subscription={subscription} organization={organization} />
      <ManagedNote subscription={subscription} />
      {isNewBillingUI && (
        <HeaderCards organization={organization} subscription={subscription} />
      )}
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
