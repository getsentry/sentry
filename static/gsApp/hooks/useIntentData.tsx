import {useEffect, useState} from 'react';

import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';

import type {PaymentCreateResponse, PaymentSetupCreateResponse} from 'getsentry/types';

interface HookProps {
  endpoint: string;
}

interface HookResult {
  error: string | undefined;
  intentData: PaymentSetupCreateResponse | PaymentCreateResponse | undefined;
  isError: boolean;
  isLoading: boolean;
}

/**
 * Get payment method setup intent data.
 */
function useSetupIntentData({endpoint}: HookProps): HookResult {
  const [setupIntentData, setSetupIntentData] = useState<
    PaymentSetupCreateResponse | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const {mutate: loadSetupIntentData} = useMutation<PaymentSetupCreateResponse>({
    mutationFn: () => fetchMutation({url: endpoint, method: 'POST'}),
    onSuccess: data => {
      setSetupIntentData(data);
      setIsLoading(false);
    },
    onError: err => {
      setError(err.message);
      setIsLoading(false);
    },
  });

  useEffect(() => {
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
function usePaymentIntentData({endpoint}: HookProps): HookResult {
  const {
    isLoading,
    isPending,
    data: paymentIntentData,
    error,
    isError,
  } = useApiQuery<PaymentCreateResponse>([endpoint], {
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

export {useSetupIntentData, usePaymentIntentData};
