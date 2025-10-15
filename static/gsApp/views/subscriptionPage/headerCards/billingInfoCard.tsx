import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import type {Subscription} from 'getsentry/types';
import {hasSomeBillingDetails} from 'getsentry/utils/billing';
import {countryHasSalesTax, getTaxFieldInfo} from 'getsentry/utils/salesTax';
import SubscriptionHeaderCard from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';

function BillingInfoCard({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  return (
    <SubscriptionHeaderCard
      title={t('Billing information')}
      sections={[
        <Flex
          key="billing-info"
          direction="column"
          gap="md"
          align="start"
          maxWidth="100%"
        >
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
    return (
      <Flex direction="column" gap="sm">
        <Placeholder height="14px" />
        <Placeholder height="14px" />
      </Flex>
    );
  }

  if (!billingDetails || !hasSomeBillingDetails(billingDetails)) {
    return (
      <Container maxWidth="100%" overflow="hidden">
        <Text size="sm" variant="muted">
          {t('No billing details on file')}
        </Text>
      </Container>
    );
  }

  const taxFieldInfo = getTaxFieldInfo(billingDetails.countryCode);
  const showTaxNumber =
    countryHasSalesTax(billingDetails.countryCode) && !!billingDetails.taxNumber;

  const primaryDetails = [
    billingDetails.companyName,
    billingDetails.displayAddress,
  ].filter(Boolean);

  const secondaryDetails = [
    billingDetails.billingEmail
      ? t('Billing email: %s', billingDetails.billingEmail)
      : null,
  ].filter(Boolean);

  if (showTaxNumber) {
    secondaryDetails.push(`${taxFieldInfo.label}: ${billingDetails.taxNumber}`);
  }

  return (
    <Flex maxWidth="100%" overflow="hidden" direction="column" gap="sm">
      <Text ellipsis size="sm" variant="muted">
        {primaryDetails.length > 0
          ? primaryDetails.join(', ')
          : t('No business address on file')}
      </Text>
      <Text ellipsis size="sm" variant="muted">
        {secondaryDetails.length > 0
          ? secondaryDetails.join('. ')
          : t('No billing email or tax number on file')}
      </Text>
    </Flex>
  );
}

function PaymentSourceInfo({subscription}: {subscription: Subscription}) {
  const {paymentSource} = subscription;

  if (!paymentSource) {
    return (
      <Text size="sm" variant="muted">
        {t('No payment method on file')}
      </Text>
    );
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
