import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

export function useRollback({organization}: {organization: Organization | null}) {
  return useApiQuery([`/organizations/${organization?.slug}/user-rollback/`], {
    staleTime: Infinity,
    retry: false,
    enabled: organization?.features.includes('sentry-rollback-2024') ?? false,
    retryOnMount: false,
  });
}
