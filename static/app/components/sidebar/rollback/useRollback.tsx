import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useRollback() {
  const organization = useOrganization();

  return useApiQuery([`/organizations/${organization.slug}/user-rollback/`], {
    staleTime: Infinity,
    retry: false,
    enabled: organization.features.includes('sentry-rollback-2024'),
    retryOnMount: false,
  });
}
