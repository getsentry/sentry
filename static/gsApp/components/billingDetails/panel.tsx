import {Fragment, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import BillingDetailsForm from 'getsentry/components/billingDetails/form';
import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import type {Subscription} from 'getsentry/types';
import {hasSomeBillingDetails} from 'getsentry/utils/billing';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {getCountryByCode} from 'getsentry/utils/ISO3166codes';
import {countryHasSalesTax, getTaxFieldInfo} from 'getsentry/utils/salesTax';
import type {GetsentryEventKey} from 'getsentry/utils/trackGetsentryAnalytics';

/**
 * Panel displaying existing billing details.
 */
function BillingDetailsPanel({
  organization,
  subscription,
  analyticsEvent,
  shouldExpandInitially,
  maxPanelWidth,
}: {
  organization: Organization;
  subscription: Subscription;
  analyticsEvent?: GetsentryEventKey;
  maxPanelWidth?: string;
  shouldExpandInitially?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [expandInitially, setExpandInitially] = useState(shouldExpandInitially);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    data: billingDetails,
    isLoading,
    isError: hasLoadError,
    error: loadError,
    refetch: fetchBillingDetails,
  } = useBillingDetails();

  useEffect(() => {
    if (loadError && loadError.status !== 401 && loadError.status !== 403) {
      Sentry.captureException(loadError);
    }
  }, [loadError]);

  useEffect(() => {
    if (expandInitially && !isLoading && !hasSomeBillingDetails(billingDetails)) {
      setIsEditing(true);
      setExpandInitially(false);
    }
  }, [isLoading, billingDetails, expandInitially]);

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
    <Flex
      justify={isEditing ? 'start' : 'between'}
      align="start"
      gap="3xl"
      padding="xl"
      background="primary"
      border="primary"
      radius="md"
      data-test-id="billing-details-panel"
      maxWidth={maxPanelWidth}
    >
      <Flex direction="column" gap="lg" width="100%">
        <Heading as="h2" size="lg">
          {t('Business address')}
        </Heading>
        {formError && <Alert variant="danger">{formError}</Alert>}
        {!isEditing && !!subscription.accountBalance && (
          <Text>
            {tct('Account balance: [balance]', {
              balance,
            })}
          </Text>
        )}
        {isEditing ? (
          <BillingDetailsForm
            organization={organization}
            initialData={billingDetails}
            onSubmitSuccess={() => {
              fetchBillingDetails();
              setIsEditing(false);
              setFormError(null);
            }}
            onSubmitError={error => {
              setFormError(
                Object.values(error.responseJSON || {}).join(' ') ||
                  t('An unknown error occurred.')
              );
            }}
            extraButton={
              <Button
                priority="default"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setFormError(null);
                }}
                aria-label={t('Cancel editing business address')}
              >
                {t('Cancel')}
              </Button>
            }
            analyticsEvent={analyticsEvent}
          />
        ) : billingDetails && hasSomeBillingDetails(billingDetails) ? (
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
                {`${billingDetails.city || ''}${billingDetails.region ? `${billingDetails.city ? ', ' : ''}${billingDetails.region}` : ''}${billingDetails.postalCode ? ` ${billingDetails.postalCode}` : ''}`}
              </Text>
            )}
            {billingDetails.countryCode && (
              <Text>{getCountryByCode(billingDetails.countryCode)?.name}</Text>
            )}
            {countryHasSalesTax(billingDetails?.countryCode) && taxFieldInfo && (
              <Flex gap="sm" align="center">
                <Text>
                  {taxFieldInfo.label}: {billingDetails.taxNumber}
                </Text>
                <QuestionTooltip
                  title={tct(
                    "Your company's [taxNumberName] will appear on all receipts. You may be subject to taxes depending on country specific tax policies.",
                    {taxNumberName: <Text bold>{taxFieldInfo.taxNumberName}</Text>}
                  )}
                  size="xs"
                />
              </Flex>
            )}
          </Fragment>
        ) : (
          <Text>{t('No business address on file')}</Text>
        )}
      </Flex>
      {!isEditing && (
        <Button
          priority="default"
          size="sm"
          onClick={() => setIsEditing(true)}
          aria-label={t('Edit business address')}
        >
          {t('Edit')}
        </Button>
      )}
    </Flex>
  );
}

export default BillingDetailsPanel;
