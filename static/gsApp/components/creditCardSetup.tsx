import {useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

import type {SubmitData} from 'getsentry/components/creditCardForm';
import CreditCardForm from 'getsentry/components/creditCardForm';
import type {PaymentSetupCreateResponse, Subscription} from 'getsentry/types';

type Props = {
  onSuccess: (data: Subscription) => void;
  organization: Organization;
  buttonText?: string;
  cancelButtonText?: string;
  className?: string;
  isModal?: boolean;
  onCancel?: () => void;
  referrer?: string;
};

/**
 * Credit Card form and submit handler for SetupIntent based cards.
 */
function CreditCardSetup({
  organization,
  onSuccess,
  onCancel,
  isModal,
  className,
  buttonText = t('Save Changes'),
  cancelButtonText = t('Cancel'),
  referrer,
}: Props) {
  const api = useApi();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [intentData, setIntentData] = useState<PaymentSetupCreateResponse | undefined>(
    undefined
  );

  const loadData = useCallback(async () => {
    setErrorMessage(undefined);
    try {
      const payload: PaymentSetupCreateResponse = await api.requestPromise(
        `/organizations/${organization.slug}/payments/setup/`,
        {method: 'POST'}
      );
      setIntentData(payload);
    } catch (e) {
      setErrorMessage(t('Unable to initialize payment setup, please try again later.'));
    }
  }, [api, organization]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit({
    stripe,
    cardElement,
    onComplete,
    validationErrors,
  }: SubmitData) {
    if (validationErrors.length) {
      onComplete();
      setErrorMessage(validationErrors[0]);
      return;
    }
    if (!intentData) {
      onComplete();
      setErrorMessage(
        t('Cannot complete your payment setup at this time, please try again later.')
      );
      return;
    }

    let setupResult: stripe.SetupIntentResponse;
    try {
      setupResult = await stripe.confirmCardSetup(intentData.clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });
    } catch (error) {
      Sentry.withScope(scope => {
        scope.setLevel('warning' as any);
        scope.setExtra('error', error);
        Sentry.captureException(new Error('Could not complete setup intent.'));
      });
      onComplete();
      setErrorMessage(
        t('Could not complete your payment setup, please try again later.')
      );
      return;
    }
    if (setupResult.error) {
      onComplete();
      setErrorMessage(setupResult.error.message);
      return;
    }
    if (!setupResult.setupIntent) {
      onComplete();
      setErrorMessage(
        t('Could not complete your payment setup, please try again later.')
      );
      return;
    }

    try {
      const subscription: Subscription = await api.requestPromise(
        `/customers/${organization.slug}/`,
        {
          method: 'PUT',
          data: {
            paymentMethod: setupResult.setupIntent.payment_method,
          },
        }
      );
      onComplete();
      onSuccess(subscription);
    } catch (error) {
      Sentry.withScope(scope => {
        scope.setLevel('warning' as any);
        scope.setExtra('error', error);
        Sentry.captureException(
          new Error('Could not update subscription with payment method.')
        );
      });
      onComplete();
      setErrorMessage(
        t('Could not complete your payment setup, please try again later.')
      );
      return;
    }
  }

  return (
    <CreditCardForm
      className={className}
      buttonText={buttonText}
      cancelButtonText={cancelButtonText}
      error={errorMessage}
      footerClassName={isModal ? 'modal-footer' : 'form-actions'}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      referrer={referrer}
    />
  );
}

export default CreditCardSetup;
