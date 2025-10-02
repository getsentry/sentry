import {useMemo} from 'react';
import moment from 'moment-timezone';

import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Placeholder from 'sentry/components/placeholder';
import {IconSettings, IconUser} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import type {Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import SubscriptionHeaderCard from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';
import SeerAutomationAlert from 'getsentry/views/subscriptionPage/seerAutomationAlert';

import {SubscriptionCard} from './subscriptionCard';
import {UsageCard} from './usageCard';

interface HeaderCardsProps {
  organization: Organization;
  subscription: Subscription;
}

function HeaderCards({organization, subscription}: HeaderCardsProps) {
  const isNewBillingUI = hasNewBillingUI(organization);

  const cards = [
    <BillingInfoCard
      key="billing-info"
      subscription={subscription}
      organization={organization}
    />,
  ].filter(card => card !== null);

  return (
    <ErrorBoundary mini>
      <SeerAutomationAlert organization={organization} />
      {isNewBillingUI ? (
        <Grid
          columns={{
            xs: '1fr',
            sm: `repeat(${Math.min(cards.length, 2)}, 1fr)`,
            md: `repeat(${cards.length}, 1fr)`,
          }}
        >
          {cards}
        </Grid>
      ) : (
        <Grid
          background="primary"
          border="primary"
          radius="md"
          columns={{lg: 'auto minmax(0, 600px)'}}
          gap={{lg: 'xl'}}
        >
          <SubscriptionCard organization={organization} subscription={subscription} />
          <UsageCard organization={organization} subscription={subscription} />
        </Grid>
      )}
    </ErrorBoundary>
  );
}

function BillingInfoCard({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const {data: billingDetails, isLoading} = useBillingDetails();
  const {paymentSource} = subscription;

  const BillingDetailsInfo = useMemo(() => {
    if (isLoading) {
      return (
        <Flex direction="column" gap="xs">
          <Placeholder height="16px" />
          <Placeholder height="16px" />
          <Placeholder height="16px" />
          <Placeholder height="16px" />
        </Flex>
      );
    }

    if (!billingDetails) {
      return (
        <Container>
          <Text>{t('No billing details on file')}</Text>
        </Container>
      );
    }

    return (
      <Flex direction="column" gap="xs">
        {billingDetails.companyName && (
          <Text variant="muted" size="sm">
            {billingDetails.companyName}
          </Text>
        )}
        {billingDetails.billingEmail && (
          <Text variant="muted" size="sm">
            {billingDetails.billingEmail}
          </Text>
        )}
        {billingDetails.displayAddress && (
          <Text variant="muted" size="sm">
            {billingDetails.displayAddress}
          </Text>
        )}
      </Flex>
    );
  }, [billingDetails, isLoading]);

  if (
    subscription.isSelfServePartner ||
    (!subscription.canSelfServe && !subscription.onDemandInvoiced)
  ) {
    return null;
  }

  const paymentSourceExpiryDate = paymentSource
    ? moment(new Date(paymentSource.expYear, paymentSource.expMonth - 1))
    : null;

  const PaymentSourceInfo = paymentSource ? (
    <Flex direction="column" gap="xs">
      <Text>{tct('Card ending in [last4]', {last4: paymentSource.last4})}</Text>
      <Text variant="muted" size="sm">
        {tct('Expires [expMonth]/[expYear]', {
          expMonth: paymentSourceExpiryDate?.format('MM'),
          expYear: paymentSourceExpiryDate?.format('YY'),
        })}
      </Text>
    </Flex>
  ) : (
    <Text>{t('No payment method on file')}</Text>
  );

  return (
    <SubscriptionHeaderCard
      title={t('Billing information')}
      icon={<IconUser />}
      sections={[BillingDetailsInfo, PaymentSourceInfo]}
      button={{
        ariaLabel: t('Edit billing information'),
        label: t('Edit billing information'),
        linkTo: `/settings/${organization.slug}/billing/details/`,
        icon: <IconSettings />,
        priority: 'default',
      }}
    />
  );
}

export default HeaderCards;
