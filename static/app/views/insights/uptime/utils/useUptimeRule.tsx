import {
  type ApiQueryKey,
  type QueryClient,
  setApiQueryData,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

interface UseUptimeRuleOptions {
  projectSlug: string;
  uptimeRuleId: string;
}

export function useUptimeRule(
  {projectSlug, uptimeRuleId}: UseUptimeRuleOptions,
  options: Partial<UseApiQueryOptions<UptimeRule>> = {}
) {
  const organization = useOrganization();

  const queryKey: ApiQueryKey = [
    `/projects/${organization.slug}/${projectSlug}/uptime/${uptimeRuleId}/`,
  ];
  return useApiQuery<UptimeRule>(queryKey, {staleTime: 0, ...options});
}

interface SetUptimeRuleDataOptions {
  organizationSlug: string;
  projectSlug: string;
  queryClient: QueryClient;
  uptimeRule: UptimeRule;
}

export function setUptimeRuleData({
  queryClient,
  organizationSlug,
  projectSlug,
  uptimeRule,
}: SetUptimeRuleDataOptions) {
  const queryKey: ApiQueryKey = [
    `/projects/${organizationSlug}/${projectSlug}/uptime/${uptimeRule.id}/`,
  ];
  setApiQueryData(queryClient, queryKey, uptimeRule);
}
