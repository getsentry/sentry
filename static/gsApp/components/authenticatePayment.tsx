import {useState} from 'react';
import {useStripe} from '@stripe/react-stripe-js';
import type {PaymentIntentResult} from '@stripe/stripe-js';
import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';

interface AuthenticatePaymentProps {
  /**
   * Client secret of a PaymentIntent the server already tried to charge with
   * the card on file, which stopped at the issuer's 3D Secure challenge.
   */
  clientSecret: string;
  /**
   * The invoice the PaymentIntent pays. The server confirms the payment
   * against it.
   */
  invoiceGuid: string;
  /**
   * Called with a message for the customer when the challenge fails or the
   * charge does not go through. Either way the intent is spent and cannot be
   * retried, so callers must move the customer off this form.
   */
  onFailure: (message: string) => void | Promise<void>;
  /**
   * Called once the server has confirmed the invoice is paid.
   */
  onSuccess: () => void;
  organization: Organization;
  errorMessage?: string;
  onCancel?: () => void;
}

/**
 * Completes a payment that stopped at a 3D Secure challenge.
 *
 * There is no card to collect: the charge was already attempted with the card
 * on file and the issuer asked for authentication, so all that is left is the
 * challenge itself. Rendering a `PaymentElement` here would ask the customer to
 * re-enter a card they have already given us.
 *
 * The two-step dance is required by the intent's `confirmation_method`. The
 * server created it as `manual`, so `handleCardAction` authenticates but stops
 * at `requires_confirmation` -- the money has not moved. Only the server can
 * confirm from there, hence the POST afterwards.
 *
 * Must be rendered inside a `StripeWrapper`.
 */
export function AuthenticatePayment({
  clientSecret,
  invoiceGuid,
  organization,
  onFailure,
  onSuccess,
  onCancel,
  errorMessage,
}: AuthenticatePaymentProps) {
  const stripe = useStripe();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {mutateAsync: confirmPayment} = useMutation({
    mutationFn: (paymentIntentId: string) =>
      fetchMutation<{paid: boolean; failureCode?: string | null}>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/payments/$paymentId/confirm/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              paymentId: invoiceGuid,
            },
          }
        ),
        method: 'POST',
        data: {paymentIntentId},
      }),
  });

  const fail = async (message: string) => {
    setIsSubmitting(false);
    await onFailure(message);
  };

  const handleAuthenticate = async () => {
    if (!stripe) {
      await fail(t('Cannot complete your payment at this time, please try again later.'));
      return;
    }
    setIsSubmitting(true);

    const verificationFailed = t(
      'That verification did not go through. Please try again or use another card.'
    );

    let result: PaymentIntentResult;
    try {
      result = await stripe.handleCardAction(clientSecret);
    } catch {
      // handleCardAction rejects outright on some failures rather than
      // resolving with an error. Uncaught, that strands the button in its
      // busy state with nothing on screen to explain why.
      await fail(verificationFailed);
      return;
    }
    if (result.error) {
      await fail(result.error.message ?? verificationFailed);
      return;
    }

    try {
      const response = await confirmPayment(result.paymentIntent.id);
      if (!response.paid) {
        // An issuer can still decline after 3D Secure. "Not paid" covers
        // outcomes other than a decline too, so only say the card was declined
        // when it was, or the customer is sent to change a card that is
        // working fine.
        const declined = response.failureCode?.includes('declined');
        await fail(
          declined
            ? t('Your bank declined the payment. Please try a different card.')
            : t('We could not complete the payment. Please try again.')
        );
        return;
      }
    } catch (err) {
      const detail = (err as RequestError)?.responseJSON?.detail;
      await fail(
        typeof detail === 'string' ? detail : t('Could not complete the payment.')
      );
      return;
    }

    onSuccess();
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
