import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

interface UseUptimeRuleOptions {
  detectorId: string;
  projectSlug: string;
}

export function useUptimeRule(
  {projectSlug, detectorId}: UseUptimeRuleOptions,
  options: Partial<UseApiQueryOptions<UptimeRule>> = {}
) {
  const organization = useOrganization();

  const queryKey: ApiQueryKey = [
    `/projects/${organization.slug}/${projectSlug}/uptime/${detectorId}/`,
  ];
  return useApiQuery<UptimeRule>(queryKey, {staleTime: 0, ...options});
}
