import {useEffect} from 'react';
import {useMutation} from '@tanstack/react-query';

import {parseQueryKey, type ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {PaymentCreateResponse, PaymentSetupCreateResponse} from 'getsentry/types';

interface HookResult<
  T extends PaymentSetupCreateResponse | PaymentCreateResponse =
    | PaymentSetupCreateResponse
    | PaymentCreateResponse,
> {
  error: string | undefined;
  intentData: T | undefined;
  isError: boolean;
  isLoading: boolean;
}

/**
 * Get payment method setup intent data.
 */
export function useSetupIntentData({
  queryKey,
}: {
  queryKey: ApiQueryKey;
}): HookResult<PaymentSetupCreateResponse> {
  const {url} = parseQueryKey(queryKey);
  const {data, error, isError, isSuccess, mutate} = useMutation({
    mutationFn: () => fetchMutation<PaymentSetupCreateResponse>({url, method: 'POST'}),
  });

  useEffect(() => {
    mutate();
  }, [mutate]);

  return {
    intentData: data,
    isLoading: !isSuccess && !isError,
    isError,
    error: getIntentErrorMessage(error),
  };
}

/**
 * Get payment intent data.
 */
export function usePaymentIntentData({
  queryKey,
}: {
  queryKey: ApiQueryKey;
}): HookResult<PaymentCreateResponse> {
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

function getIntentErrorMessage(error: Error | null): string | undefined {
  if (!(error instanceof RequestError)) {
    return error?.message;
  }
  const detail = error.responseJSON?.detail;
  return typeof detail === 'string' ? detail : (detail?.message ?? error.message);
}
