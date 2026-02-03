import getApiUrl from 'sentry/utils/api/getApiUrl';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {BillingDetails} from 'getsentry/types';

export function useBillingDetails() {
  const organization = useOrganization();

  return useApiQuery<BillingDetails>(
    [
      getApiUrl(`/customers/$organizationIdOrSlug/billing-details/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
      retry: (failureCount, apiError: any) => {
        // Don't retry on auth errors
        if (apiError.status === 401 || apiError.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
    }
  );
}
