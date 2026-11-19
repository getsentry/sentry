import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {BillingHistory} from 'getsentry/types';

export function useCurrentBillingHistory() {
  const organization = useOrganization();

  const {
    data: history,
    isPending,
    isError,
  } = useQuery(
    apiOptions.as<BillingHistory>()('/customers/$organizationIdOrSlug/history/current/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    })
  );

  const currentHistory = useMemo(() => {
    return history ?? null;
  }, [history]);

  return {currentHistory, isPending, isError};
}
