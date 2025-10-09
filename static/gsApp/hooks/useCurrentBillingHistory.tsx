import {useMemo} from 'react';

import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {BillingHistory} from 'getsentry/types';

export function useCurrentBillingHistory() {
  const organization = useOrganization();

  const {
    data: histories,
    isPending,
    isError,
  } = useApiQuery<BillingHistory[]>([`/customers/${organization.slug}/history/`], {
    staleTime: 0, // TODO(billing): Create an endpoint that returns the current history
  });

  const currentHistory: BillingHistory | null = useMemo(() => {
    if (!histories) return null;
    return histories.find((history: BillingHistory) => history.isCurrent) ?? null;
  }, [histories]);

  return {currentHistory, isPending, isError};
}
