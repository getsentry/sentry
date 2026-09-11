import {LinkButton} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';

import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import type {Subscription} from 'getsentry/types';
import {hasSomeBillingDetails} from 'getsentry/utils/billing';
import {formatCurrency} from 'getsentry/utils/formatCurrency';
import {countryHasSalesTax, getTaxFieldInfo} from 'getsentry/utils/salesTax';
import {SubscriptionHeaderCard} from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';

const MAX_WIDTH = 'calc(100vw - 48px - 32px)'; // 100vw - 48px (outer padding) - 32px (inner padding)

export function BillingInfoCard({
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
        <Stack key="billing-info" gap="md" align="start" maxWidth="100%">
          <AccountBalanceInfo subscription={subscription} />
          <BillingDetailsInfo />
          <PaymentSourceInfo subscription={subscription} />
        </Stack>,
        <LinkButton
          key="edit-billing-information"
          aria-label={t('Edit billing information')}
          to={`/settings/${organization.slug}/billing/details/`}
          variant="link"
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

function AccountBalanceInfo({subscription}: {subscription: Subscription}) {
  const {accountBalance} = subscription;

  if (!accountBalance) {
    return null;
  }

  const isCredit = accountBalance < 0;

  return (
    <Text bold ellipsis size="sm">
      {isCredit
        ? tct('Account credits: [amount]', {amount: formatCurrency(0 - accountBalance)})
        : tct('Balance due: [amount]', {amount: formatCurrency(accountBalance)})}
    </Text>
  );
}

function BillingDetailsInfo() {
  const {layout} = usePrimaryNavigation();
  const isMobile = layout === 'mobile';
  const {data: billingDetails, isLoading} = useBillingDetails();

  if (isLoading) {
    return (
      <Stack gap="sm">
        <Placeholder height="14px" />
        <Placeholder height="14px" />
      </Stack>
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

  return (
    <Stack overflow="hidden" gap="sm" maxWidth={isMobile ? MAX_WIDTH : '100%'}>
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
    </Stack>
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
