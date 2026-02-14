import {useEffect, useState} from 'react';
import type {
  PaymentMethod,
  SetupIntentResult,
  Stripe,
  StripeElements,
} from '@stripe/stripe-js';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';

import InnerIntentForm from 'getsentry/components/creditCardEdit/intentForms/innerIntentForm';
import type {IntentFormProps} from 'getsentry/components/creditCardEdit/intentForms/types';
import {useSetupIntentData} from 'getsentry/hooks/useIntentData';
import type {Subscription} from 'getsentry/types';

function SetupIntentForm(props: IntentFormProps) {
  const {
    organization,
    location: ftcConsentLocation,
    onSuccess,
    onSuccessWithSubscription,
  } = props;
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {intentData, isLoading, isError, error} = useSetupIntentData({
    endpoint: props.intentDataEndpoint,
  });

  const {mutateAsync: updateSubscription} = useMutation({
    mutationFn: ({paymentMethod}: {paymentMethod: string | PaymentMethod | null}) =>
      fetchMutation<Subscription>({
        method: 'PUT',
        url: `/customers/${organization.slug}/`,
        data: {
          paymentMethod,
          ftcConsentLocation,
        },
      }),
    onSuccess: (data: Subscription) => {
      addSuccessMessage(t('Updated payment method.'));
      onSuccessWithSubscription?.(data);
      onSuccess?.();
      setIsSubmitting(false);
    },
    onError: () => {
      setErrorMessage(t('Could not update payment method.'));
      setIsSubmitting(false);
    },
  });

  useEffect(() => {
    if (isError) {
      setErrorMessage(error);
    }
  }, [isError, error]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const handleSubmit = async ({
    stripe,
    elements,
  }: {
    elements: StripeElements | null;
    stripe: Stripe | null;
  }) => {
    setIsSubmitting(true);
    if (!stripe || !elements || !intentData) {
      setErrorMessage(
        t('Cannot complete your payment at this time, please try again later.')
      );
      setIsSubmitting(false);
      return;
    }

    const stripeResult = await elements.submit();
    if (stripeResult.error) {
      setErrorMessage(stripeResult.error.message ?? t('Setup failed.'));
      setIsSubmitting(false);
      return;
    }

    stripe
      .confirmSetup({
        elements,
        clientSecret: intentData.clientSecret,
        redirect: 'if_required', // if the payment method requires redirects, we redirect to the return_url on completion
        confirmParams: {
          return_url: window.location.href,
        },
      })
      .then((result: SetupIntentResult) => {
        if (result.error) {
          setErrorMessage(result.error.message ?? t('Setup failed.'));
          setIsSubmitting(false);
          return;
        }
        updateSubscription({
          paymentMethod: result.setupIntent.payment_method,
        });
      });
  };

  return (
    <InnerIntentForm
      {...props}
      isSubmitting={isSubmitting}
      busyButtonText={t('Saving Changes...')}
      buttonText={props.buttonText}
      intentData={intentData}
      onError={setErrorMessage}
      handleSubmit={handleSubmit}
      errorMessage={errorMessage}
    />
  );
}

export default SetupIntentForm;
