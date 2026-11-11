import {useState} from 'react';
import {useStripe} from '@stripe/react-stripe-js';
import type {PaymentIntentResult} from '@stripe/stripe-js';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type {RequestError} from 'sentry/utils/requestError/requestError';

import type {PaymentIntentFormProps} from 'getsentry/components/creditCardEdit/intentForms/types';
import {paymentIntentOptions} from 'getsentry/hooks/useIntentData';
import type {PaymentCreateResponse} from 'getsentry/types';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

interface Props extends PaymentIntentFormProps {
  intentData: PaymentCreateResponse;
  onError: (message: string) => void;
  errorMessage?: string;
}

/**
 * Completes a payment that stopped at a 3D Secure challenge.
 *
 * Distinct from {@link PaymentIntentForm} in that there is no card to collect:
 * the charge was already attempted with the card on file and the issuer asked
 * for authentication, so all that is left is the challenge itself. Rendering a
 * `PaymentElement` here would ask the customer to re-enter a card they have
 * already given us.
 *
 * The two-step dance is required by the intent's `confirmation_method`. The
 * server created it as `manual`, so `handleCardAction` authenticates but stops
 * at `requires_confirmation` -- the money has not moved. Only the server can
 * confirm from there, hence the POST afterwards.
 */
export function AuthenticateIntentForm({
  intentData,
  organization,
  referrer,
  invoiceGuid,
  onCancel,
  onSuccess,
  onError,
  errorMessage,
}: Props) {
  const stripe = useStripe();
  const queryClient = useQueryClient();
  // Errors are owned by the parent: a failed challenge swaps this form out for
  // the card form, and the explanation has to survive that or the customer is
  // handed a card form with no idea why.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {mutateAsync: confirmPayment} = useMutation({
    mutationFn: ({
      paymentId,
      paymentIntentId,
    }: {
      paymentId: string;
      paymentIntentId: string;
    }) =>
      fetchMutation<{paid: boolean; failureCode?: string | null}>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/payments/$paymentId/confirm/',
          {
            path: {organizationIdOrSlug: organization.slug, paymentId},
          }
        ),
        method: 'POST',
        data: {paymentIntentId},
      }),
  });

  /**
   * Recover from a failed challenge.
   *
   * A failed authentication leaves the intent in `requires_payment_method` --
   * it cannot be retried, and Stripe requires a new payment method to fulfil
   * it. Refetching the intent is what unsticks the customer: the server sees
   * the parked intent is no longer actionable, releases its claim on the
   * invoice, and issues a fresh intent. That response has no `requiresAction`,
   * so the modal swaps this card-less form for the normal payment form and the
   * customer can pay with another card.
   */
  const handleAuthenticationFailed = async (stripeMessage?: string) => {
    onError(
      stripeMessage ??
        t('That verification did not go through. Please try again or use another card.')
    );
    setIsSubmitting(false);
    await queryClient.invalidateQueries({
      queryKey: paymentIntentOptions(organization.slug, invoiceGuid).queryKey,
    });
  };

  const handleAuthenticate = async () => {
    if (!stripe) {
      onError(t('Cannot complete your payment at this time, please try again later.'));
      return;
    }
    setIsSubmitting(true);

    let result: PaymentIntentResult;
    try {
      result = await stripe.handleCardAction(intentData.clientSecret);
    } catch (err) {
      // handleCardAction rejects outright on some failures rather than
      // resolving with an error. Uncaught, that strands the button in its
      // busy state with nothing on screen to explain why.
      await handleAuthenticationFailed();
      return;
    }
    if (result.error) {
      await handleAuthenticationFailed(result.error.message);
      return;
    }

    try {
      const response = await confirmPayment({
        paymentId: invoiceGuid,
        paymentIntentId: result.paymentIntent.id,
      });
      if (!response.paid) {
        // Authentication succeeded but the charge did not complete -- an issuer
        // can still decline after 3D Secure. That leaves the intent spent in the
        // same way a failed challenge does, so recover the same way and let the
        // customer try another card.
        //
        // "not paid" covers outcomes other than a decline, so only say the card
        // was declined when it was, or the customer is sent to change a card
        // that is working fine.
        const declined = response.failureCode?.includes('declined');
        await handleAuthenticationFailed(
          declined
            ? t('Your bank declined the payment. Please try a different card.')
            : t('We could not complete the payment. Please try again.')
        );
        return;
      }
    } catch (err) {
      const detail = (err as RequestError)?.responseJSON?.detail;
      await handleAuthenticationFailed(
        typeof detail === 'string' ? detail : t('Could not complete the payment.')
      );
      return;
    }

    trackGetsentryAnalytics('billing_failure.paid_now', {
      organization,
      referrer: decodeScalar(referrer),
    });
    toast.success(t('Payment sent successfully.'));
    onSuccess?.();
    setIsSubmitting(false);
  };

  return (
    <Stack gap="xl">
      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
      <Text as="p">
        {t(
          'Your bank needs to verify this payment before it can be completed. No new card details are needed.'
        )}
      </Text>
      <Stack direction="row" gap="md" justify="end">
        {onCancel && (
          <Button aria-label={t('Cancel')} onClick={onCancel}>
            {t('Cancel')}
          </Button>
        )}
        <Button
          variant="primary"
          disabled={isSubmitting || !stripe}
          onClick={handleAuthenticate}
          data-test-id="authenticate-payment"
        >
          {isSubmitting ? t('Verifying…') : t('Verify with your bank')}
        </Button>
      </Stack>
    </Stack>
  );
}
