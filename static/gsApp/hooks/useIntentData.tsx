import {useEffect, useState} from 'react';
import {useMutation} from '@tanstack/react-query';

import {parseQueryKey, type ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';

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
  const [setupIntentData, setSetupIntentData] = useState<
    PaymentSetupCreateResponse | undefined
  >(undefined);
  const {url} = parseQueryKey(queryKey);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const {mutate: loadSetupIntentData} = useMutation<
    PaymentSetupCreateResponse,
    RequestError
  >({
    mutationFn: () => fetchMutation({url, method: 'POST'}),
    onSuccess: data => {
      setSetupIntentData(data);
      setIsLoading(false);
    },
    onError: err => {
      const errorMessage =
        typeof err?.responseJSON?.detail === 'string'
          ? err?.responseJSON?.detail
          : (err?.responseJSON?.detail?.message ?? err?.message);
      setError(errorMessage);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setIsLoading(true);
    loadSetupIntentData();
  }, [loadSetupIntentData]);

  return {
    intentData: setupIntentData,
    isLoading,
    isError: !!error,
    error,
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

  const errorMessage =
    typeof error?.responseJSON?.detail === 'string'
      ? error?.responseJSON?.detail
      : (error?.responseJSON?.detail?.message ?? error?.message);

  return {
    intentData: paymentIntentData,
    isLoading: isLoading || isPending,
    isError,
    error: errorMessage,
  };
}
