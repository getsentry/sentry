import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {keepPreviousData} from '@tanstack/react-query';
import type {Location} from 'history';

import {Button} from 'sentry/components/core/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import withOrganization from 'sentry/utils/withOrganization';

import {openEditBillingDetails, openEditCreditCard} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {BillingDetails as BillingDetailsType, Subscription} from 'getsentry/types';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {getCountryByCode} from 'getsentry/utils/ISO3166codes';
import {countryHasSalesTax, getTaxFieldInfo} from 'getsentry/utils/salesTax';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
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
  const [cardLastFourDigits, setCardLastFourDigits] = useState<string | null>(null);
  const [cardZipCode, setCardZipCode] = useState<string | null>(null);

  useEffect(() => {
    if (subscription?.paymentSource) {
      setCardLastFourDigits(prev => prev ?? (subscription.paymentSource?.last4 || null));
      setCardZipCode(prev => prev ?? (subscription.paymentSource?.zipCode || null));
    }
  }, [subscription]);

  const handleCardUpdated = useCallback((data: Subscription) => {
    setCardLastFourDigits(data.paymentSource?.last4 || null);
    setCardZipCode(data.paymentSource?.zipCode || null);
    SubscriptionStore.set(data.slug, data);
  }, []);

  useEffect(() => {
    if (!organization || !subscription) return;

    trackSubscriptionView(organization, subscription, 'details');

    // Open update credit card modal and track clicks from payment failure emails and GS Banner
    const queryReferrer = decodeScalar(location?.query?.referrer);
    // There are multiple billing failure referrals and each should have analytics tracking
    if (queryReferrer?.includes('billing-failure')) {
      openEditCreditCard({
        organization,
        subscription,
        onSuccess: handleCardUpdated,
        location,
      });
      trackGetsentryAnalytics('billing_failure.button_clicked', {
        organization,
        referrer: queryReferrer,
      });
    }
  }, [organization, subscription, location, handleCardUpdated]);

  const hasBillingPerms = organization.access?.includes('org:billing');
  if (!hasBillingPerms) {
    return <ContactBillingMembers />;
  }

  if (!subscription) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <SubscriptionHeader organization={organization} subscription={subscription} />
      <RecurringCredits displayType="discount" planDetails={subscription.planDetails} />
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

      <BillingDetailsPanel organization={organization} subscription={subscription} />
    </Fragment>
  );
}

function BillingDetailsPanel({
  organization,
  subscription,
  title,
}: {
  organization: Organization;
  subscription: Subscription;
  title?: string;
}) {
  const {
    data: billingDetails,
    isPending: isLoading,
    isError: hasLoadError,
    error: loadError,
    refetch: fetchBillingDetails,
  } = useApiQuery<BillingDetailsType>(
    [`/customers/${organization.slug}/billing-details/`],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors
        if (error.status === 401 || error.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
    }
  );

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
      <PanelBody data-test-id="account-balance">
        {subscription.accountBalance ? (
          <FieldGroup label="Account Balance">{balance}</FieldGroup>
        ) : null}

        <PanelBody>
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
export {BillingDetailsPanel};

/** @internal exported for tests only */
export {BillingDetails};
