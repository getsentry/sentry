import {useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {RecurringCredit} from 'getsentry/types';

const hasBilling = ({access}: Organization) => access?.includes('org:billing');

interface RecurringCreditsContext {
  isLoading: boolean;
  recurringCredits: RecurringCredit[];
}

export function useRecurringCredits(): RecurringCreditsContext {
  const organization = useOrganization();
  const enabled = hasBilling(organization);
  const {data: recurringCredits = [], isPending} = useQuery({
    ...apiOptions.as<RecurringCredit[]>()(
      '/customers/$organizationIdOrSlug/recurring-credits/',
      {path: {organizationIdOrSlug: organization.slug}, staleTime: Infinity}
    ),
    enabled,
  });
  return {recurringCredits, isLoading: enabled ? isPending : false};
}
