import {useMemo} from 'react';

import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {BillingHistory} from 'getsentry/types';

export function useCurrentBillingHistory() {
  const organization = useOrganization();

  const {
    data: history,
    isPending,
    isError,
  } = useApiQuery<BillingHistory>(
    [
      getApiUrl(`/customers/$organizationIdOrSlug/history/current/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {
      staleTime: 0,
    }
  );

  const currentHistory: BillingHistory | null = useMemo(() => {
    return history ?? null;
  }, [history]);

  return {currentHistory, isPending, isError};
}
