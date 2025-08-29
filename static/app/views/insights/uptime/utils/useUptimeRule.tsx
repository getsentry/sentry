import {
  setApiQueryData,
  useApiQuery,
  type ApiQueryKey,
  type QueryClient,
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
    {
      // TODO(epurkhiser): Can be removed once these APIs only take detectors
      query: {useDetectorId: 1},
    },
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
    `/projects/${organizationSlug}/${projectSlug}/uptime/${uptimeRule.detectorId}/`,
    {
      // TODO(epurkhiser): Can be removed once these APIs only take detectors
      query: {useDetectorId: 1},
    },
  ];
  setApiQueryData(queryClient, queryKey, uptimeRule);
}
