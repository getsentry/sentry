import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {RecurringCredit} from 'getsentry/types';

const hasBilling = ({access}: Organization) => access?.includes('org:billing');

interface RecurringCreditsContext {
  isLoading: boolean;
  recurringCredits: RecurringCredit[];
}

export function useRecurringCredits(): RecurringCreditsContext {
  const organization = useOrganization();
  const enabled = hasBilling(organization);
  const {data: recurringCredits = [], isPending} = useApiQuery<RecurringCredit[]>(
    [
      getApiUrl(`/customers/$organizationIdOrSlug/recurring-credits/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {staleTime: Infinity, enabled, notifyOnChangeProps: ['data', 'isLoading']}
  );
  return {recurringCredits, isLoading: enabled ? isPending : false};
}
