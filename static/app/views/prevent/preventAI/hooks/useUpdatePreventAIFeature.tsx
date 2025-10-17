import {updateOrganization} from 'sentry/actionCreators/organizations';
import type {Organization} from 'sentry/types/organization';
import type {
  PreventAIConfig,
  PreventAIFeatureTriggers,
  Sensitivity,
} from 'sentry/types/prevent';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UpdatePreventAIFeatureParams {
  enabled: boolean;
  // 'use_org_defaults' is a special case that will remove the entire repo override
  feature: 'vanilla' | 'test_generation' | 'bug_prediction' | 'use_org_defaults';
  orgId: string;
  // if repoId is provided, edit repo_overrides for that repo, otherwise edit org_defaults
  repoId?: string | null;
  sensitivity?: Sensitivity;
  trigger?: Partial<PreventAIFeatureTriggers>;
}

export function useUpdatePreventAIFeature() {
  const organization = useOrganization();
  const {mutateAsync, isPending, error} = useMutation({
    mutationFn: async (params: UpdatePreventAIFeatureParams) => {
      if (!organization.preventAiConfigGithub) {
        throw new Error('Organization has no AI Code Review config');
      }
      const newConfig = makePreventAIConfig(organization.preventAiConfigGithub, params);

      return fetchMutation<Partial<Organization>>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
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

/**
 * Makes a new PreventAIConfig object with feature settings applied for the specified org and/or repo
 * 1. Deep clones the original config to prevent mutation
 * 2. Get the org config for the specified orgName or create it from default_org_config template if not exists
 * 3. If editing repo, get the repo override for the specified repoName or create it from org_defaults template if not exists
 * 4. Modifies the specified feature's settings, preserves any unspecified settings.
 * 5. Special case: 'use_org_defaults' feature type will remove the entire repo override
 *
 * @param originalConfig Original PreventAIConfig object (will not be mutated)
 * @param params Parameters to update
 * @returns New (copy of) PreventAIConfig object with updates applied
 */
export function makePreventAIConfig(
  originalConfig: PreventAIConfig,
  params: UpdatePreventAIFeatureParams
) {
  const updatedConfig = structuredClone(originalConfig);

  const orgConfig =
    updatedConfig.github_organizations[params.orgId] ??
    structuredClone(updatedConfig.default_org_config);
  updatedConfig.github_organizations[params.orgId] = orgConfig;

  if (params.feature === 'use_org_defaults') {
    if (!params.repoId) {
      throw new Error('Repo ID is required when feature is use_org_defaults');
    }
    if (params.enabled) {
      delete orgConfig.repo_overrides[params.repoId];
    } else {
      orgConfig.repo_overrides[params.repoId] = structuredClone(orgConfig.org_defaults);
    }
    return updatedConfig;
  }

  let featureConfig = orgConfig.org_defaults;
  if (params.repoId) {
    let repoOverride = orgConfig.repo_overrides[params.repoId];
    if (!repoOverride) {
      repoOverride = structuredClone(orgConfig.org_defaults);
      orgConfig.repo_overrides[params.repoId] = repoOverride;
    }
    featureConfig = repoOverride;
  }

  featureConfig[params.feature] = {
    enabled: params.enabled,
    triggers: {...featureConfig[params.feature].triggers, ...params.trigger},
    sensitivity: params.sensitivity ?? featureConfig[params.feature].sensitivity,
  };

  return updatedConfig;
}
