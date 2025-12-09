import {Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';

import StripeCreditCardSetup from 'getsentry/components/creditCardEdit/stripeSetup';
import type {FTCConsentLocation, Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import trackGetsentryAnalytics, {
  type GetsentryEventKey,
} from 'getsentry/utils/trackGetsentryAnalytics';

interface CreditCardSetupProps {
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
  const isNewBillingUI = hasNewBillingUI(organization);

  const commonProps = {
    organization,
    location,
    budgetTerm,
    buttonText: buttonText ?? t('Save Changes'),
    referrer,
  };

  return (
    <Fragment>
      {referrer?.includes('billing-failure') && (
        <Alert.Container>
          <Alert type="warning" showIcon={false}>
            {t('Your credit card will be charged upon update.')}
          </Alert>
        </Alert.Container>
      )}
      <StripeCreditCardSetup
        onCancel={onCancel ?? (() => {})}
        onSuccess={() => {
          onSuccess?.();
          if (analyticsEvent) {
            trackGetsentryAnalytics(analyticsEvent, {
              organization,
              referrer: decodeScalar(referrer),
              isStripeComponent: true,
              isNewBillingUI,
            });
          }
        }}
        onSuccessWithSubscription={onSuccessWithSubscription}
        {...commonProps}
      />
    </Fragment>
  );
}

export default CreditCardSetup;
