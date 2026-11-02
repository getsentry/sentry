import type {Stripe, StripeElements} from '@stripe/stripe-js';
import {useMutation} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';

import {InnerIntentForm} from 'getsentry/components/creditCardEdit/intentForms/innerIntentForm';
import type {IntentFormProps} from 'getsentry/components/creditCardEdit/intentForms/types';
import type {PaymentSetupCreateResponse, Subscription} from 'getsentry/types';

export function SetupIntentForm(props: IntentFormProps) {
  const {
    organization,
    location: ftcConsentLocation,
    onSuccess,
    onSuccessWithSubscription,
  } = props;
  const {url: setupIntentUrl} = parseQueryKey(props.intentDataQueryKey);
  const {mutateAsync: savePaymentMethod, isPending} = useMutation({
    mutationFn: async ({
      stripe,
      elements,
    }: {
      elements: StripeElements | null;
      stripe: Stripe | null;
    }) => {
      if (!stripe || !elements) {
        throw new Error(
          t('Cannot complete your payment at this time, please try again later.')
        );
      }

      let intentData: PaymentSetupCreateResponse;
      try {
        intentData = await fetchMutation<PaymentSetupCreateResponse>({
          url: setupIntentUrl,
          method: 'POST',
        });
      } catch (error) {
        throw new Error(
          getRequestErrorUserMessage(error, t('Could not set up payment method.'))
        );
      }

      const result = await stripe.confirmSetup({
        elements,
        clientSecret: intentData.clientSecret,
        redirect: 'if_required', // if the payment method requires redirects, we redirect to the return_url on completion
        confirmParams: {
          return_url: window.location.href,
        },
      });
      if (result.error) {
        throw new Error(result.error.message ?? t('Setup failed.'));
      }

      return fetchMutation<Subscription>({
        method: 'PUT',
        url: getApiUrl('/customers/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data: {
          paymentMethod: result.setupIntent.payment_method,
          ftcConsentLocation,
        },
      });
    },
    onSuccess: (data: Subscription) => {
      addSuccessMessage(t('Updated payment method.'));
      onSuccessWithSubscription?.(data);
      onSuccess?.();
    },
    onError: error => {
      toast.error(
        getRequestErrorUserMessage(error, t('Could not update payment method.'))
      );
    },
  });

  return (
    <InnerIntentForm
      {...props}
      isSubmitting={isPending}
      buttonText={props.buttonText}
      handleSubmit={async ({stripe, elements}) => {
        if (elements) {
          const {error} = await elements.submit();
          if (error) {
            // Stripe displays validation errors beside the affected fields.
            return;
          }
        }
        await savePaymentMethod({stripe, elements});
      }}
    />
  );
}
