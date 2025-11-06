import type {PreventAIConfig} from 'sentry/types/prevent';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

interface UsePreventAIGitHubConfigOptions {
  gitOrgName: string;
}

interface UsePreventAIGitHubConfigResult {
  default_org_config: PreventAIConfig;
  schema_version: string;
  organization?: PreventAIConfig | Record<string, never>;
}

export function usePreventAIGitHubConfig({gitOrgName}: UsePreventAIGitHubConfigOptions) {
  const organization = useOrganization();

  return useApiQuery<UsePreventAIGitHubConfigResult, RequestError>(
    [`/organizations/${organization.slug}/prevent/ai/github/config/${gitOrgName}/`],
    {
      staleTime: 30000,
    }
  );
}
