import {cloneElement, Fragment, isValidElement} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import {getPlanIcon} from 'getsentry/utils/billing';
import {isDisabledByPartner} from 'getsentry/utils/partnerships';
import {PartnershipNote} from 'getsentry/views/subscriptionPage/partnershipNote';

import {HeaderCards} from './headerCards/headerCards';
import {DecidePendingChanges} from './decidePendingChanges';
import {ManagedNote} from './managedNote';
import {SubscriptionUpsellBanner} from './subscriptionUpsellBanner';
import {TrialAlert} from './trialAlert';
import {hasPermissions} from './utils';

type Props = {
  organization: Organization;
  subscription: Subscription;
};

/**
 * Header and Tab navigation common across subscription views.
 */
export function SubscriptionHeader(props: Props) {
  const {subscription, organization} = props;
  const hasBillingPerms = hasPermissions(organization, 'org:billing');
  const isDisabled = isDisabledByPartner(subscription);
  const planIcon = getPlanIcon(subscription.planDetails);

  return (
    <Stack gap="xl" background="secondary">
      <SentryDocumentTitle title={t('Subscription')} orgSlug={organization.slug} />

      <Stack gap="md" background="primary" borderBottom="primary" padding="2xl 3xl">
        <Flex
          justify="between"
          align={{'screen:xs': 'start', 'screen:sm': 'center'}}
          direction={{'screen:xs': 'column', 'screen:sm': 'row'}}
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
                variant="primary"
              >
                {t('Manage plan')}
              </LinkButton>
            )}
          </Flex>
        </Flex>
      </Stack>
      <Stack padding="0 2xl xl" gap="xl" borderBottom="primary">
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
      </Stack>
    </Stack>
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
    <Stack gap="xl">
      {subscription.pendingChanges ? (
        <DecidePendingChanges subscription={subscription} organization={organization} />
      ) : null}
      <TrialAlert subscription={subscription} organization={organization} />
      <HeaderCards organization={organization} subscription={subscription} />
      <ManagedNote subscription={subscription} />
    </Stack>
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
