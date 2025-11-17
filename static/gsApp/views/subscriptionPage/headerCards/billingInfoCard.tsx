import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';

import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import type {Subscription} from 'getsentry/types';
import {hasSomeBillingDetails} from 'getsentry/utils/billing';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {countryHasSalesTax, getTaxFieldInfo} from 'getsentry/utils/salesTax';
import SubscriptionHeaderCard from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';

const MAX_WIDTH = 'calc(100vw - 48px - 32px)'; // 100vw - 48px (outer padding) - 32px (inner padding)

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
          <BillingDetailsInfo subscription={subscription} />
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

function BillingDetailsInfo({subscription}: {subscription: Subscription}) {
  const {layout} = useNavContext();
  const isMobile = layout === NavLayout.MOBILE;
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
      <Container overflow="hidden" maxWidth={isMobile ? MAX_WIDTH : '100%'}>
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

  const balance =
    subscription.accountBalance < 0
      ? tct('[credits] credit', {
          credits: formatCurrency(0 - subscription.accountBalance),
        })
      : `${formatCurrency(subscription.accountBalance)}`;

  return (
    <Flex
      overflow="hidden"
      direction="column"
      gap="sm"
      maxWidth={isMobile ? MAX_WIDTH : '100%'}
    >
      {!!subscription.accountBalance && (
        <Text ellipsis size="sm" variant="muted">
          {tct('Account balance: [balance]', {
            balance,
          })}
        </Text>
      )}
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
      {tct('[cardBrand] ending in [last4]', {
        cardBrand: toTitleCase(paymentSource.brand, {allowInnerUpperCase: true}),
        last4: paymentSource.last4,
      })}
    </Text>
  );
}

export default BillingInfoCard;
