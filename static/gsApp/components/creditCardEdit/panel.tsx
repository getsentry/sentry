import {Fragment, useCallback, useEffect, useState} from 'react';
import type {Location} from 'history';
import moment from 'moment-timezone';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';

import {openEditCreditCard} from 'getsentry/actionCreators/modal';
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
  isNewBillingUI?: boolean;
  shouldExpandInitially?: boolean;
}

function TextForField({children}: {children: React.ReactNode}) {
  return (
    <Flex minHeight="37px" align="center">
      <Text as="span">{children}</Text>
    </Flex>
  );
}

/**
 * Panel displaying existing credit card details.
 */
function CreditCardPanel({
  organization,
  subscription,
  location,
  isNewBillingUI,
  budgetTerm,
  ftcLocation,
  analyticsEvent,
  shouldExpandInitially,
}: CreditCardPanelProps) {
  const [cardLastFourDigits, setCardLastFourDigits] = useState<string | null>(null);
  const [cardZipCode, setCardZipCode] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!!shouldExpandInitially);
  const [fromBillingFailure, setFromBillingFailure] = useState(false);
  const [referrer, setReferrer] = useState<string | undefined>(undefined);

  const handleCardUpdated = useCallback((data: Subscription) => {
    setCardLastFourDigits(data.paymentSource?.last4 || null);
    setCardZipCode(data.paymentSource?.zipCode || null);
    SubscriptionStore.set(data.slug, data);
  }, []);

  useEffect(() => {
    if (subscription.paymentSource) {
      setCardLastFourDigits(prev => prev ?? (subscription.paymentSource?.last4 || null));
      setCardZipCode(prev => prev ?? (subscription.paymentSource?.zipCode || null));
    }
  }, [subscription]);

  useEffect(() => {
    // Open credit card update form/modal and track clicks from payment failure notifications (in app, email, etc.)
    setReferrer(decodeScalar(location.query?.referrer));
  }, [location.query?.referrer]);

  useEffect(() => {
    // There are multiple billing failure referrals and each should have analytics tracking
    if (referrer?.includes('billing-failure')) {
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
        referrer,
      });
    }
  }, [location, isNewBillingUI, organization, subscription, handleCardUpdated, referrer]);

  if (!isNewBillingUI) {
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
            <Text>{`****${subscription.paymentSource.last4} ${moment(new Date(subscription.paymentSource.expYear, subscription.paymentSource.expMonth - 1)).format('MM/YY')}`}</Text>
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

export default CreditCardPanel;
