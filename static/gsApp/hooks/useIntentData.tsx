import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {useApiQuery} from 'sentry/utils/queryClient';
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
export function usePaymentIntentData({queryKey}: {queryKey: ApiQueryKey}): HookResult {
  const {
    isLoading,
    isPending,
    data: paymentIntentData,
    error,
    isError,
  } = useApiQuery<PaymentCreateResponse>(queryKey, {
    staleTime: Infinity,
  });

  return {
    intentData: paymentIntentData,
    isLoading: isLoading || isPending,
    isError,
    error: getIntentErrorMessage(error),
  };
}

export function getIntentErrorMessage(error: Error | null): string | undefined {
  if (!(error instanceof RequestError)) {
    return error?.message;
  }
  const detail = error.responseJSON?.detail;
  return typeof detail === 'string' ? detail : (detail?.message ?? error.message);
}
