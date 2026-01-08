import {Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';

import CreditCardForm from 'getsentry/components/creditCardEdit/form';
import type {FTCConsentLocation, Subscription} from 'getsentry/types';
import trackGetsentryAnalytics, {
  type GetsentryEventKey,
} from 'getsentry/utils/trackGetsentryAnalytics';

export interface CreditCardSetupProps {
  budgetTerm: string;
  organization: Organization;
  analyticsEvent?: GetsentryEventKey;
  buttonText?: string;
  location?: FTCConsentLocation;
  onCancel?: () => void;
  onSuccess?: () => void;
  onSuccessWithSubscription?: (data: Subscription) => void;
  referrer?: string;
}

function CreditCardSetup({
  organization,
  referrer,
  onSuccess,
  onSuccessWithSubscription,
  onCancel,
  location,
  budgetTerm,
  buttonText,
  analyticsEvent,
}: CreditCardSetupProps) {
  return (
    <Fragment>
      {referrer?.includes('billing-failure') && (
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t('Your credit card will be charged upon update.')}
          </Alert>
        </Alert.Container>
      )}
      <CreditCardForm
        organization={organization}
        location={location}
        budgetTerm={budgetTerm}
        buttonText={buttonText ?? t('Save Changes')}
        referrer={referrer}
        cardMode="setup"
        intentDataEndpoint={`/organizations/${organization.slug}/payments/setup/`}
        onCancel={onCancel ?? (() => {})}
        onSuccess={() => {
          onSuccess?.();
          if (analyticsEvent) {
            trackGetsentryAnalytics(analyticsEvent, {
              organization,
              referrer: decodeScalar(referrer),
              isStripeComponent: true,
              isNewBillingUI: true,
            });
          }
        }}
        onSuccessWithSubscription={onSuccessWithSubscription}
      />
    </Fragment>
  );
}

export default CreditCardSetup;
