import {Fragment, useEffect, useState} from 'react';
import type {Location} from 'history';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import CreditCardSetup from 'getsentry/components/creditCardEdit/setup';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {FTCConsentLocation, Subscription} from 'getsentry/types';
import {getCountryByCode} from 'getsentry/utils/ISO3166codes';
import type {GetsentryEventKey} from 'getsentry/utils/trackGetsentryAnalytics';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

interface CreditCardPanelProps {
  budgetTerm: string;
  ftcLocation: FTCConsentLocation;
  location: Location;
  organization: Organization;
  subscription: Subscription;
  analyticsEvent?: GetsentryEventKey;
  maxPanelWidth?: string;
  shouldExpandInitially?: boolean;
}

/**
 * Panel displaying existing credit card details.
 */
function CreditCardPanel({
  organization,
  subscription,
  location,
  budgetTerm,
  ftcLocation,
  analyticsEvent,
  shouldExpandInitially,
  maxPanelWidth,
}: CreditCardPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fromBillingFailure, setFromBillingFailure] = useState(false);
  const [referrer, setReferrer] = useState<string | undefined>(undefined);
  const [expandInitially, setExpandInitially] = useState(
    shouldExpandInitially && !subscription.paymentSource
  );

  const handleCardUpdated = (data: Subscription) => {
    // if the card was successfully updated, reset the billing failure state
    // so we don't trigger side effects nor render outdated content
    setFromBillingFailure(false);
    setReferrer(undefined);
    SubscriptionStore.set(data.slug, data);
  };

  useEffect(() => {
    if (expandInitially) {
      setIsEditing(true);
      setExpandInitially(false);
    }
  }, [expandInitially]);

  useEffect(() => {
    // Open credit card update form/modal and track clicks from payment failure notifications (in app, email, etc.)
    setReferrer(decodeScalar(location.query?.referrer));
  }, [location.query?.referrer]);

  useEffect(() => {
    // There are multiple billing failure referrals and each should have analytics tracking
    if (referrer?.includes('billing-failure')) {
      setFromBillingFailure(true);

      setIsEditing(true);

      trackGetsentryAnalytics('billing_failure.button_clicked', {
        organization,
        referrer,
      });
    }
  }, [organization, referrer]);

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
      data-test-id="credit-card-panel"
      maxWidth={maxPanelWidth}
    >
      <Flex direction="column" gap="lg" width="100%">
        <Heading as="h2" size="lg">
          {t('Payment method')}
        </Heading>
        {isEditing ? (
          <CreditCardSetup
            organization={organization}
            onSuccess={() => setIsEditing(false)}
            onCancel={() => setIsEditing(false)}
            onSuccessWithSubscription={handleCardUpdated}
            location={ftcLocation}
            budgetTerm={budgetTerm}
            referrer={referrer}
            analyticsEvent={
              analyticsEvent ??
              (fromBillingFailure
                ? 'billing_failure.updated_cc'
                : 'billing_details.updated_cc')
            }
          />
        ) : subscription.paymentSource ? (
          <Fragment>
            <Text>{`${toTitleCase(subscription.paymentSource.brand, {allowInnerUpperCase: true})} ****${subscription.paymentSource.last4} ${String(subscription.paymentSource.expMonth).padStart(2, '0')}/${String(subscription.paymentSource.expYear).slice(-2)}`}</Text>
            <Text>{`${countryName ? `${countryName} ` : ''} ${subscription.paymentSource.zipCode ? subscription.paymentSource.zipCode : ''}`}</Text>
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

export default CreditCardPanel;
