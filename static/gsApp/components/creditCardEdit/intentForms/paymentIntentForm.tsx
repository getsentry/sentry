import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import type {PaymentIntentResult, Stripe, StripeElements} from '@stripe/stripe-js';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {decodeScalar} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';

import {AuthenticateIntentForm} from 'getsentry/components/creditCardEdit/intentForms/authenticateIntentForm';
import {InnerIntentForm} from 'getsentry/components/creditCardEdit/intentForms/innerIntentForm';
import type {IntentFormProps} from 'getsentry/components/creditCardEdit/intentForms/types';
import {usePaymentIntentData} from 'getsentry/hooks/useIntentData';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

/** What DRF's NotFound serializes to, which is all the client gets back. */
const NOT_FOUND_DETAIL = 'Not found.';

export function PaymentIntentForm(props: IntentFormProps) {
  const {organization, referrer, onSuccess, invoiceGuid} = props;
  const api = useApi();
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {intentData, isLoading, isError, error} = usePaymentIntentData({
    queryKey: props.intentDataQueryKey,
  });

  useEffect(() => {
    if (isError) {
      // oxlint-disable-next-line react/set-state-in-effect
      setErrorMessage(
        error === NOT_FOUND_DETAIL
          ? t('This invoice can no longer be paid. Refresh the page to see its status.')
          : error
      );
    }
  }, [isError, error]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  // A charge already attempted with the card on file, waiting only on the
  // issuer's 3D Secure challenge. Collecting a card here would be asking for
  // one we already have.
  if (intentData?.requiresAction) {
    return (
      <AuthenticateIntentForm
        {...props}
        intentData={intentData}
        onError={setErrorMessage}
        errorMessage={errorMessage}
      />
    );
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
      .then(async (result: PaymentIntentResult) => {
        if (result.error) {
          setErrorMessage(result.error.message ?? t('Payment failed.'));
          setIsSubmitting(false);
          return;
        }

        // The money has moved, but only Stripe knows that. Tell the server
        // rather than waiting for the charge.succeeded webhook: until
        // something records the charge, the customer has paid and their
        // invoice still says they have not. The webhook remains a backstop
        // and is idempotent on the Stripe charge id.
        //
        // Failing to record is never silent: the customer has been charged, so
        // anything that stops us writing it down needs to be visible rather
        // than left for someone to notice a paid customer with an unpaid
        // invoice.
        const paymentIntentId = result.paymentIntent.id;
        if (invoiceGuid) {
          try {
            await api.requestPromise(
              getApiUrl(
                '/organizations/$organizationIdOrSlug/payments/$paymentId/confirm/',
                {path: {organizationIdOrSlug: organization.slug, paymentId: invoiceGuid}}
              ),
              {method: 'POST', data: {paymentIntentId}}
            );
          } catch (err) {
            // The payment itself succeeded, so this is not the customer's
            // problem to solve -- the webhook still reconciles it. Report it
            // with enough context to find the charge.
            Sentry.withScope(scope => {
              scope.setExtras({invoiceGuid, paymentIntentId});
              scope.setTag('payment_confirm_failed', 'true');
              Sentry.captureException(err);
            });
          }
        } else {
          Sentry.withScope(scope => {
            scope.setExtras({paymentIntentId});
            Sentry.captureMessage(
              'Payment succeeded but no invoice was supplied to record it against'
            );
          });
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
