import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {BillingDetails} from 'getsentry/types';

export function useBillingDetails() {
  const organization = useOrganization();

  return useQuery({
    ...apiOptions.as<BillingDetails>()(
      '/customers/$organizationIdOrSlug/billing-details/',
      {
        path: {organizationIdOrSlug: organization.slug},
        staleTime: 0,
      }
    ),
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      if (
        error instanceof RequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        return false;
      }
      return failureCount < 3;
    },
  });
}
