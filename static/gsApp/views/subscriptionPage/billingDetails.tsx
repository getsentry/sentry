import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import moment from 'moment-timezone';

import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import withOrganization from 'sentry/utils/withOrganization';

import {openEditBillingDetails, openEditCreditCard} from 'getsentry/actionCreators/modal';
import BillingDetailsForm from 'getsentry/components/billingDetailsForm';
import CreditCardSetup from 'getsentry/components/creditCardSetup';
import withSubscription from 'getsentry/components/withSubscription';
import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {FTCConsentLocation, type Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {getCountryByCode} from 'getsentry/utils/ISO3166codes';
import {countryHasSalesTax, getTaxFieldInfo} from 'getsentry/utils/salesTax';
import trackGetsentryAnalytics, {
  type GetsentryEventKey,
} from 'getsentry/utils/trackGetsentryAnalytics';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import RecurringCredits from 'getsentry/views/subscriptionPage/recurringCredits';

import SubscriptionHeader from './subscriptionHeader';
import {trackSubscriptionView} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  subscription: Subscription;
};

/**
 * Update billing details view.
 */
function BillingDetails({organization, subscription, location}: Props) {
  useEffect(() => {
    if (!organization || !subscription) return;

    trackSubscriptionView(organization, subscription, 'details');
  }, [organization, subscription, location]);

  const hasBillingPerms = organization.access?.includes('org:billing');
  if (!hasBillingPerms) {
    return <ContactBillingMembers />;
  }

  if (!subscription) {
    return <LoadingIndicator />;
  }

  const isNewBillingUI = hasNewBillingUI(organization);

  if (isNewBillingUI) {
    return (
      <Container>
        <SubscriptionHeader organization={organization} subscription={subscription} />
        <RecurringCredits displayType="discount" planDetails={subscription.planDetails} />
        <Flex direction="column" gap="xl">
          <PaymentMethodPanel
            organization={organization}
            subscription={subscription}
            location={location}
            isNewBillingUI={isNewBillingUI}
            ftcLocation={FTCConsentLocation.BILLING_DETAILS}
            budgetTerm={subscription.planDetails.budgetTerm}
          />
          <BillingDetailsPanel
            organization={organization}
            subscription={subscription}
            isNewBillingUI={isNewBillingUI}
          />
        </Flex>
      </Container>
    );
  }

  return (
    <Container>
      <SubscriptionHeader organization={organization} subscription={subscription} />
      <RecurringCredits displayType="discount" planDetails={subscription.planDetails} />
      <PaymentMethodPanel
        organization={organization}
        subscription={subscription}
        location={location}
        isNewBillingUI={isNewBillingUI}
        ftcLocation={FTCConsentLocation.BILLING_DETAILS}
        budgetTerm={subscription.planDetails.budgetTerm}
      />
      <BillingDetailsPanel
        organization={organization}
        subscription={subscription}
        isNewBillingUI={isNewBillingUI}
      />
    </Container>
  );
}

function PaymentMethodPanel({
  organization,
  subscription,
  location,
  isNewBillingUI,
  budgetTerm,
  ftcLocation,
  analyticsEvent,
}: Props & {
  budgetTerm: string;
  ftcLocation: FTCConsentLocation;
  analyticsEvent?: GetsentryEventKey;
  isNewBillingUI?: boolean;
}) {
  const [cardLastFourDigits, setCardLastFourDigits] = useState<string | null>(null);
  const [cardZipCode, setCardZipCode] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fromBillingFailure, setFromBillingFailure] = useState(false);

  const handleCardUpdated = useCallback((data: Subscription) => {
    setCardLastFourDigits(data.paymentSource?.last4 || null);
    setCardZipCode(data.paymentSource?.zipCode || null);
    SubscriptionStore.set(data.slug, data);
  }, []);

  useEffect(() => {
    if (subscription?.paymentSource) {
      setCardLastFourDigits(prev => prev ?? (subscription.paymentSource?.last4 || null));
      setCardZipCode(prev => prev ?? (subscription.paymentSource?.zipCode || null));
    }
  }, [subscription]);

  useEffect(() => {
    if (!organization || !subscription) return;

    // Open credit card update form/modal and track clicks from payment failure notifications (in app, email, etc.)
    const queryReferrer = decodeScalar(location.query?.referrer);
    // There are multiple billing failure referrals and each should have analytics tracking
    if (queryReferrer?.includes('billing-failure')) {
      setFromBillingFailure(true);
      if (isNewBillingUI) {
        setIsEditing(true);
      } else {
        openEditCreditCard({
          organization,
          subscription,
          onSuccess: handleCardUpdated,
          location,
        });
      }
      trackGetsentryAnalytics('billing_failure.button_clicked', {
        organization,
        referrer: queryReferrer,
      });
    }
  }, [organization, subscription, location, handleCardUpdated, isNewBillingUI]);

  if (isNewBillingUI) {
    const countryName = getCountryByCode(subscription.paymentSource?.countryCode)?.name;
    return (
      <Flex
        justify={isEditing ? 'start' : 'between'}
        align="start"
        gap="3xl"
        padding="xl"
        background="primary"
        border="primary"
        radius="md"
      >
        <Flex direction="column" gap="lg" width="100%">
          <Heading as="h2" size="lg">
            {t('Payment method')}
          </Heading>
          {isEditing ? (
            <CreditCardSetup
              organization={organization}
              onSuccess={() => {}}
              onCancel={() => setIsEditing(false)}
              onSuccessWithSubscription={handleCardUpdated}
              location={ftcLocation}
              budgetTerm={budgetTerm}
              analyticsEvent={
                (analyticsEvent ?? fromBillingFailure)
                  ? 'billing_failure.updated_cc'
                  : 'billing_details.updated_cc'
              }
            />
          ) : subscription.paymentSource ? (
            <Fragment>
              <Text>{`****${subscription.paymentSource.last4} ${moment(new Date(subscription.paymentSource.expYear, subscription.paymentSource.expMonth)).format('MM/YY')}`}</Text>
              <Text>{`${countryName ? `${countryName} ` : ''} ${subscription.paymentSource.zipCode}`}</Text>
            </Fragment>
          ) : (
            <Text>{t('No payment method on file')}</Text>
          )}
        </Flex>
        {!isEditing && (
          <Button
            priority="default"
            size="sm"
            onClick={() => setIsEditing(true)}
            aria-label={t('Edit payment method')}
          >
            {t('Edit')}
          </Button>
        )}
      </Flex>
    );
  }

  return (
    <Panel className="ref-credit-card-details">
      <PanelHeader hasButtons>
        {t('Credit Card On File')}
        <Button
          data-test-id="update-card"
          priority="primary"
          size="sm"
          onClick={() =>
            openEditCreditCard({
              organization,
              subscription,
              onSuccess: handleCardUpdated,
            })
          }
        >
          {t('Update card')}
        </Button>
      </PanelHeader>
      <PanelBody>
        <FieldGroup label={t('Credit Card Number')}>
          <TextForField>
            {cardLastFourDigits ? (
              `xxxx xxxx xxxx ${cardLastFourDigits}`
            ) : (
              <em>{t('No card on file')}</em>
            )}
          </TextForField>
        </FieldGroup>

        <FieldGroup
          label={t('Postal Code')}
          help={t('Postal code associated with the card on file')}
        >
          <TextForField>{cardZipCode}</TextForField>
        </FieldGroup>
      </PanelBody>
    </Panel>
  );
}

function BillingDetailsPanel({
  organization,
  subscription,
  title,
  isNewBillingUI,
}: {
  organization: Organization;
  subscription: Subscription;
  isNewBillingUI?: boolean;
  title?: string;
}) {
  const {
    data: billingDetails,
    isLoading,
    isError: hasLoadError,
    error: loadError,
    refetch: fetchBillingDetails,
  } = useBillingDetails();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (loadError && loadError.status !== 401 && loadError.status !== 403) {
      Sentry.captureException(loadError);
    }
  }, [loadError]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (hasLoadError) {
    return <LoadingError onRetry={() => fetchBillingDetails()} />;
  }

  const taxFieldInfo = getTaxFieldInfo(billingDetails?.countryCode);
  const balance =
    subscription.accountBalance < 0
      ? tct('[credits] credit', {
          credits: formatCurrency(0 - subscription.accountBalance),
        })
      : `${formatCurrency(subscription.accountBalance)}`;

  if (isNewBillingUI) {
    return (
      <Flex
        justify={isEditing ? 'start' : 'between'}
        align="start"
        gap="3xl"
        padding="xl"
        background="primary"
        border="primary"
        radius="md"
      >
        <Flex direction="column" gap="lg" width="100%">
          <Heading as="h2" size="lg">
            {t('Invoice address')}
          </Heading>
          {isEditing ? (
            <BillingDetailsForm
              organization={organization}
              initialData={billingDetails}
              onSubmitSuccess={fetchBillingDetails}
              extraButton={
                <Button
                  priority="default"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  aria-label={t('Cancel editing invoice address')}
                >
                  {t('Cancel')}
                </Button>
              }
            />
          ) : billingDetails ? (
            <Fragment>
              {billingDetails.billingEmail && <Text>{billingDetails.billingEmail}</Text>}
              {billingDetails.companyName && <Text>{billingDetails.companyName}</Text>}
              {billingDetails.addressLine1 && (
                <Text>
                  {billingDetails.addressLine1} {billingDetails.addressLine2 ?? ''}
                </Text>
              )}
              {(billingDetails.city ||
                billingDetails.region ||
                billingDetails.postalCode) && (
                <Text>
                  {`${billingDetails.city}${billingDetails.region ? `, ${billingDetails.region}` : ''}${billingDetails.postalCode ? ` ${billingDetails.postalCode}` : ''}`}
                </Text>
              )}
              {billingDetails.countryCode && (
                <Text>{getCountryByCode(billingDetails.countryCode)?.name}</Text>
              )}
              {billingDetails.taxNumber && (
                <Text>
                  {taxFieldInfo.label}: {billingDetails.taxNumber}
                </Text>
              )}
            </Fragment>
          ) : (
            <Text>{t('No invoice address on file')}</Text>
          )}
        </Flex>
        {!isEditing && (
          <Button
            priority="default"
            size="sm"
            onClick={() => setIsEditing(true)}
            aria-label={t('Edit invoice address')}
          >
            {t('Edit')}
          </Button>
        )}
      </Flex>
    );
  }

  return (
    <Panel className="ref-billing-details">
      <PanelHeader>
        {title ?? t('Billing Details')}
        <Button
          priority="primary"
          size="sm"
          onClick={() =>
            openEditBillingDetails({
              organization,
              initialData: billingDetails,
              refetch: fetchBillingDetails,
            })
          }
          disabled={!organization.access.includes('org:billing')}
        >
          {t('Update details')}
        </Button>
      </PanelHeader>
      <PanelBody>
        {subscription.accountBalance ? (
          <FieldGroup id="account-balance" label="Account Balance">
            {balance}
          </FieldGroup>
        ) : null}
        <FieldGroup label={t('Billing Email')}>
          <TextForField>{billingDetails?.billingEmail}</TextForField>
        </FieldGroup>
        <FieldGroup label={t('Company Name')}>
          <TextForField>{billingDetails?.companyName}</TextForField>
        </FieldGroup>
        <FieldGroup label={t('Address Line 1')}>
          <TextForField>{billingDetails?.addressLine1}</TextForField>
        </FieldGroup>
        <FieldGroup label={t('Address Line 2')}>
          <TextForField>{billingDetails?.addressLine2}</TextForField>
        </FieldGroup>
        <FieldGroup label={t('City')}>
          <TextForField>{billingDetails?.city}</TextForField>
        </FieldGroup>
        <FieldGroup label={t('State / Region')}>
          <TextForField>{billingDetails?.region}</TextForField>
        </FieldGroup>
        <FieldGroup label={t('Postal Code')}>
          <TextForField>{billingDetails?.postalCode}</TextForField>
        </FieldGroup>
        <FieldGroup label={t('Country')}>
          <TextForField>
            {getCountryByCode(billingDetails?.countryCode)?.name}
          </TextForField>
        </FieldGroup>
        {countryHasSalesTax(billingDetails?.countryCode) && taxFieldInfo && (
          <FieldGroup
            label={taxFieldInfo.label}
            help={tct(
              "Your company's [taxNumberName] will appear on all receipts. You may be subject to taxes depending on country specific tax policies.",
              {taxNumberName: <strong>{taxFieldInfo.taxNumberName}</strong>}
            )}
          >
            <TextForField>{billingDetails?.taxNumber}</TextForField>
          </FieldGroup>
        )}
      </PanelBody>
    </Panel>
  );
}

// Sets the min-height so a field displaying text will be the same height as a
// field that has an input
const TextForField = styled('span')`
  min-height: 37px;
  display: flex;
  align-items: center;
`;

export default withSubscription(withOrganization(BillingDetails));
export {BillingDetailsPanel, PaymentMethodPanel};

/** @internal exported for tests only */
export {BillingDetails};
