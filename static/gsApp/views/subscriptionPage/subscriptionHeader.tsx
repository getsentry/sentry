import {cloneElement, Fragment, isValidElement} from 'react';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconCodecov} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openCodecovModal} from 'getsentry/actionCreators/modal';
import PartnerPlanEndingBanner from 'getsentry/components/partnerPlanEndingBanner';
import type {Subscription} from 'getsentry/types';
import {
  getPlanIcon,
  hasAccessToSubscriptionOverview,
  hasPartnerMigrationFeature,
} from 'getsentry/utils/billing';
import {isDisabledByPartner} from 'getsentry/utils/partnerships';
import PartnershipNote from 'getsentry/views/subscriptionPage/partnershipNote';

import HeaderCards from './headerCards/headerCards';
import DecidePendingChanges from './decidePendingChanges';
import ManagedNote from './managedNote';
import {SubscriptionUpsellBanner} from './subscriptionUpsellBanner';
import TrialAlert from './trialAlert';
import {hasPermissions} from './utils';

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

  const planIcon = getPlanIcon(subscription.planDetails);

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
  return (
    <Fragment>
      <TrialAlert subscription={subscription} organization={organization} />
      <ManagedNote subscription={subscription} />
      <HeaderCards organization={organization} subscription={subscription} />
    </Fragment>
  );
}

export default SubscriptionHeader;
