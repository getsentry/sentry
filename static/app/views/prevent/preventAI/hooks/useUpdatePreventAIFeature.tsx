import {updateOrganization} from 'sentry/actionCreators/organizations';
import type {PreventAIConfig, PreventAIFeatureTriggers} from 'sentry/types/prevent';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface UpdatePreventAIFeatureParams {
  enabled: boolean;
  feature: 'vanilla' | 'test_generation' | 'bug_prediction';
  orgName: string;
  // if repoName is provided, edit repo_overrides for that repo, otherwise edit org_defaults
  repoName?: string;
  trigger?: Partial<PreventAIFeatureTriggers>;
}

export function useUpdatePreventAIFeature() {
  const api = useApi();
  const organization = useOrganization();
  const {mutateAsync, isPending, error} = useMutation({
    mutationFn: async (params: UpdatePreventAIFeatureParams) => {
      if (!organization.preventAiConfigGithub) {
        throw new Error('Organization has no AI Code Review config');
      }
      const newConfig = makePreventAIConfig(organization.preventAiConfigGithub, params);

      return api.requestPromise(`/organizations/${organization.slug}/`, {
        method: 'PUT',
        data: {preventAiConfigGithub: newConfig},
      });
    },
    onSuccess: updateOrganization,
  });

  return {
    enableFeature: mutateAsync,
    isLoading: isPending,
    error: error?.message,
  };
}

export function makePreventAIConfig(
  originalConfig: PreventAIConfig,
  params: UpdatePreventAIFeatureParams
) {
  // Deep clone the config so we don't mutate the original
  const updatedConfig = structuredClone(originalConfig);

  // Get or create the org config for the specified orgName
  const orgConfig =
    updatedConfig.github_organizations[params.orgName] ??
    structuredClone(updatedConfig.default_org_config);
  updatedConfig.github_organizations[params.orgName] = orgConfig;

  // Determine which feature config to update: org_defaults or repo_overrides
  let featureConfig = orgConfig.org_defaults;
  if (params.repoName) {
    // Get or create repo overrides for the specified repoName
    let repoOverride = orgConfig.repo_overrides[params.repoName];
    if (!repoOverride) {
      repoOverride = structuredClone(orgConfig.org_defaults);
      orgConfig.repo_overrides[params.repoName] = repoOverride;
    }
    featureConfig = orgConfig.repo_overrides[params.repoName]!;
  }

  // Update the relevant feature config
  featureConfig[params.feature] = {
    enabled: params.enabled,
    // Merge triggers, allowing partial updates
    triggers: {...featureConfig[params.feature].triggers, ...params.trigger},
    // Preserve the existing sensitivity setting
    sensitivity: featureConfig[params.feature].sensitivity,
  };

  return updatedConfig;
}
