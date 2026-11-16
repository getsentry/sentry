import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {PaymentCreateResponse} from 'getsentry/types';

interface HookResult {
  error: string | undefined;
  intentData: PaymentCreateResponse | undefined;
  isError: boolean;
  isLoading: boolean;
}

/**
 * Get payment intent data.
 */
export function paymentIntentOptions(organizationSlug: string, invoiceId: string) {
  return apiOptions.as<PaymentCreateResponse>()(
    '/organizations/$organizationIdOrSlug/payments/$paymentId/new/',
    {
      path: {organizationIdOrSlug: organizationSlug, paymentId: invoiceId},
      staleTime: Infinity,
    }
  );
}

export function usePaymentIntentData({
  organizationSlug,
  invoiceId,
}: {
  invoiceId: string;
  organizationSlug: string;
}): HookResult {
  const {
    isLoading,
    isPending,
    data: paymentIntentData,
    error,
    isError,
  } = useQuery(paymentIntentOptions(organizationSlug, invoiceId));

  return {
    intentData: paymentIntentData,
    isLoading: isLoading || isPending,
    isError,
    error: getIntentErrorMessage(error),
  };
}

function getIntentErrorMessage(error: Error | null): string | undefined {
  if (!(error instanceof RequestError)) {
    return error?.message;
  }
  const detail = error.responseJSON?.detail;
  return typeof detail === 'string' ? detail : (detail?.message ?? error.message);
}
