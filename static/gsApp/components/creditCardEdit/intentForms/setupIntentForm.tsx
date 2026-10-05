import {useState} from 'react';
import type {
  PaymentMethod,
  SetupIntentResult,
  Stripe,
  StripeElements,
} from '@stripe/stripe-js';
import {useMutation} from '@tanstack/react-query';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import {InnerIntentForm} from 'getsentry/components/creditCardEdit/intentForms/innerIntentForm';
import type {IntentFormProps} from 'getsentry/components/creditCardEdit/intentForms/types';
import {getIntentErrorMessage} from 'getsentry/hooks/useIntentData';
import type {PaymentSetupCreateResponse, Subscription} from 'getsentry/types';

export function SetupIntentForm(props: IntentFormProps) {
  const {
    organization,
    location: ftcConsentLocation,
    onSuccess,
    onSuccessWithSubscription,
  } = props;
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {url: setupIntentUrl} = parseQueryKey(props.intentDataQueryKey);
  const {mutateAsync: createSetupIntent} = useMutation({
    mutationFn: () =>
      fetchMutation<PaymentSetupCreateResponse>({url: setupIntentUrl, method: 'POST'}),
    onError: error => {
      setErrorMessage(getIntentErrorMessage(error) ?? t('Setup failed.'));
      setIsSubmitting(false);
    },
  });

  const {mutateAsync: updateSubscription} = useMutation({
    mutationFn: ({paymentMethod}: {paymentMethod: string | PaymentMethod | null}) =>
      fetchMutation<Subscription>({
        method: 'PUT',
        url: getApiUrl('/customers/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
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

  const handleSubmit = async ({
    stripe,
    elements,
  }: {
    elements: StripeElements | null;
    stripe: Stripe | null;
  }) => {
    setIsSubmitting(true);
    if (!stripe || !elements) {
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

    const intentData = await createSetupIntent().catch(() => null);
    if (!intentData) {
      return;
    }

    await stripe
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
        return updateSubscription({
          paymentMethod: result.setupIntent.payment_method,
        }).catch(() => {});
      });
  };

  return (
    <InnerIntentForm
      {...props}
      isSubmitting={isSubmitting}
      buttonText={props.buttonText}
      onError={message => {
        setErrorMessage(message);
        setIsSubmitting(false);
      }}
      handleSubmit={handleSubmit}
      errorMessage={errorMessage}
    />
  );
}
