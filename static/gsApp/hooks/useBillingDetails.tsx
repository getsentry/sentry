import {
  keepPreviousData,
  useApiQuery,
  type QueryObserverResult,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

import type {BillingDetails} from 'getsentry/types';

interface HookResult {
  data: BillingDetails | undefined;
  error: RequestError | null;
  isError: boolean;
  isLoading: boolean;
  refetch: () => Promise<QueryObserverResult<BillingDetails, unknown>>;
}

export function useBillingDetails(): HookResult {
  const organization = useOrganization();

  const {data, isPending, isLoading, isError, error, refetch} =
    useApiQuery<BillingDetails>([`/customers/${organization.slug}/billing-details/`], {
      staleTime: 0,
      placeholderData: keepPreviousData,
      retry: (failureCount, apiError: any) => {
        // Don't retry on auth errors
        if (apiError.status === 401 || apiError.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
    });

  return {
    data,
    isLoading: isLoading || isPending,
    isError,
    error,
    refetch,
  };
}
