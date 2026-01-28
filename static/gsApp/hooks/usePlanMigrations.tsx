import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

import type {PlanMigration} from 'getsentry/types';

const hasBillingAccess = ({access}: Organization) => access?.includes('org:billing');

interface PlanMigrationsHook {
  isLoading: boolean;
  planMigrations: PlanMigration[];
}

export function usePlanMigrations(): PlanMigrationsHook {
  const organization = useOrganization();
  const user: User = useUser();
  const enabled = hasBillingAccess(organization) || user.isStaff;
  const {data: planMigrations, isPending} = useApiQuery<PlanMigration[]>(
    [
      getApiUrl(`/customers/$organizationIdOrSlug/plan-migrations/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {scheduled: 1, applied: 0}},
    ],
    {
      staleTime: Infinity,
      enabled,
      retry: false,
      notifyOnChangeProps: ['isLoading', 'data'],
    }
  );

  return {
    planMigrations: planMigrations ?? [],
    isLoading: enabled ? isPending : false,
  };
}
