import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import type {Subscription} from 'getsentry/types';
import {hasSomeBillingDetails} from 'getsentry/utils/billing';
import SubscriptionHeaderCard from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';

function BillingInfoCard({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  if (
    subscription.isSelfServePartner ||
    (!subscription.canSelfServe && !subscription.onDemandInvoiced)
  ) {
    return null;
  }

  return (
    <SubscriptionHeaderCard
      title={t('Billing information')}
      sections={[
        <Flex key="billing-info" direction="column" gap="md" align="start">
          <BillingDetailsInfo />
          <PaymentSourceInfo subscription={subscription} />
        </Flex>,
        <LinkButton
          key="edit-billing-information"
          aria-label={t('Edit billing information')}
          to={`/settings/${organization.slug}/billing/details/`}
          priority="link"
          size="sm"
        >
          <Text size="sm" variant="accent">
            {t('Edit billing information')}
          </Text>
        </LinkButton>,
      ]}
    />
  );
}

function BillingDetailsInfo() {
  const {data: billingDetails, isLoading} = useBillingDetails();

  if (isLoading) {
    return <Placeholder height="14px" />;
  }

  if (!billingDetails || !hasSomeBillingDetails(billingDetails)) {
    return (
      <Container>
        <Text variant="muted">{t('No billing details on file')}</Text>
      </Container>
    );
  }

  return (
    <Text ellipsis size="sm" variant="muted">
      {`${billingDetails.companyName ? `${billingDetails.companyName}, ` : ''}${billingDetails.displayAddress}`}
    </Text>
  );
}

function PaymentSourceInfo({subscription}: {subscription: Subscription}) {
  const {paymentSource} = subscription;

  if (!paymentSource) {
    return <Text variant="muted">{t('No payment method on file')}</Text>;
  }

  return (
    <Text ellipsis size="sm" variant="muted">
      {tct('Card ending in [last4]', {
        last4: paymentSource.last4,
      })}
    </Text>
  );
}

export default BillingInfoCard;
