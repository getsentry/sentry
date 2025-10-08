import {useMemo} from 'react';

import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {BillingHistory} from 'getsentry/types';

export function useCurrentBillingHistory() {
  const organization = useOrganization();

  const {
    data: history,
    isPending,
    isError,
  } = useApiQuery<BillingHistory>([`/customers/${organization.slug}/history/current/`], {
    staleTime: Infinity,
  });

  const currentHistory: BillingHistory | null = useMemo(() => {
    return history ?? null;
  }, [history]);

  return {currentHistory, isPending, isError};
}
