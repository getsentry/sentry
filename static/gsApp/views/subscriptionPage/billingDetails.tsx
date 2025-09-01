import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {keepPreviousData} from '@tanstack/react-query';
import type {Location} from 'history';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
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

import {openEditCreditCard} from 'getsentry/actionCreators/modal';
import BillingDetailsForm from 'getsentry/components/billingDetailsForm';
import withSubscription from 'getsentry/components/withSubscription';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {BillingDetails as BillingDetailsType, Subscription} from 'getsentry/types';
import formatCurrency from 'getsentry/utils/formatCurrency';
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

  const balance =
    subscription.accountBalance < 0
      ? tct('[credits] credit', {
          credits: formatCurrency(0 - subscription.accountBalance),
        })
      : `${formatCurrency(subscription.accountBalance)}`;

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

      <Panel className="ref-billing-details">
        <PanelHeader>{t('Billing Details')}</PanelHeader>
        <PanelBody data-test-id="account-balance">
          {subscription.accountBalance ? (
            <FieldGroup label="Account Balance">{balance}</FieldGroup>
          ) : null}
          <BillingDetailsFormContainer organization={organization} />
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

function BillingDetailsFormContainer({organization}: {organization: Organization}) {
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

  return (
    <BillingDetailsForm
      requireChanges
      initialData={billingDetails}
      organization={organization}
      onSubmitError={() => addErrorMessage(t('Unable to update billing details.'))}
      onSubmitSuccess={() =>
        addSuccessMessage(t('Successfully updated billing details.'))
      }
      fieldProps={{
        disabled: !organization.access.includes('org:billing'),
        disabledReason: t(
          "You don't have access to manage these billing and subscription details."
        ),
      }}
    />
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

/** @internal exported for tests only */
export {BillingDetails, BillingDetailsFormContainer};
