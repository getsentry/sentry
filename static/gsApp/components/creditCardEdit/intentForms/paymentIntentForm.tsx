import {useEffect, useState} from 'react';
import type {PaymentIntentResult, Stripe, StripeElements} from '@stripe/stripe-js';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';

import InnerIntentForm from 'getsentry/components/creditCardEdit/intentForms/innerIntentForm';
import type {IntentFormProps} from 'getsentry/components/creditCardEdit/intentForms/types';
import {usePaymentIntentData} from 'getsentry/hooks/useIntentData';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

function PaymentIntentForm(props: IntentFormProps) {
  const {organization, referrer, onSuccess} = props;
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {intentData, isLoading, isError, error} = usePaymentIntentData({
    endpoint: props.intentDataEndpoint,
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
      setErrorMessage(stripeResult.error.message ?? t('Payment failed.'));
      setIsSubmitting(false);
      return;
    }

    stripe
      .confirmPayment({
        elements,
        clientSecret: intentData.clientSecret,
        redirect: 'if_required', // if the payment method requires redirects, we redirect to the return_url on completion
        confirmParams: {
          return_url: window.location.href,
        },
      })
      .then((result: PaymentIntentResult) => {
        if (result.error) {
          setErrorMessage(result.error.message ?? t('Payment failed.'));
          setIsSubmitting(false);
          return;
        }
        trackGetsentryAnalytics('billing_failure.paid_now', {
          organization,
          referrer: decodeScalar(referrer),
        });
        addSuccessMessage(t('Payment sent successfully.'));
        onSuccess?.();
        setIsSubmitting(false);
      });
  };

  return (
    <InnerIntentForm
      {...props}
      buttonText={props.buttonText}
      busyButtonText={t('Sending Payment...')}
      isSubmitting={isSubmitting}
      intentData={intentData}
      onError={setErrorMessage}
      handleSubmit={handleSubmit}
      errorMessage={errorMessage}
    />
  );
}

export default PaymentIntentForm;
