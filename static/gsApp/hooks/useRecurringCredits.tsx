import type {Organization} from 'sentry/types/organization';
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
    [`/customers/${organization.slug}/recurring-credits/`],
    {staleTime: Infinity, enabled, notifyOnChangeProps: ['data', 'isLoading']}
  );
  return {recurringCredits, isLoading: enabled ? isPending : false};
}
