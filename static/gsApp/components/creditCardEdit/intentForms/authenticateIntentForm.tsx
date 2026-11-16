import {useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';

import {AuthenticatePayment} from 'getsentry/components/authenticatePayment';
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
 * Completes an invoice payment that stopped at a 3D Secure challenge.
 *
 * Distinct from {@link PaymentIntentForm} in that there is no card to collect.
 * See {@link AuthenticatePayment} for the challenge itself.
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
  const queryClient = useQueryClient();

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
   *
   * Errors are owned by the parent: that swap unmounts this form, and the
   * explanation has to survive it or the customer is handed a card form with
   * no idea why.
   */
  const handleFailure = async (message: string) => {
    onError(message);
    await queryClient.invalidateQueries({
      queryKey: paymentIntentOptions(organization.slug, invoiceGuid).queryKey,
    });
  };

  const handleSuccess = () => {
    trackGetsentryAnalytics('billing_failure.paid_now', {
      organization,
      referrer: decodeScalar(referrer),
    });
    toast.success(t('Payment sent successfully.'));
    onSuccess?.();
  };

  return (
    <AuthenticatePayment
      clientSecret={intentData.clientSecret}
      invoiceGuid={invoiceGuid}
      organization={organization}
      onFailure={handleFailure}
      onSuccess={handleSuccess}
      onCancel={onCancel}
      errorMessage={errorMessage}
    />
  );
}
