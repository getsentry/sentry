import type {
  PreventAIConfig,
  PreventAIFeatureTriggers,
  Sensitivity,
} from 'sentry/types/prevent';
import {PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT} from 'sentry/types/prevent';
import {fetchMutation, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UpdatePreventAIFeatureParams {
  enabled: boolean;
  // 'use_org_defaults' is a special case that will remove the entire repo override
  feature: 'vanilla' | 'test_generation' | 'bug_prediction' | 'use_org_defaults';
  gitOrgName: string;
  originalConfig: PreventAIConfig;
  // if repo is provided, edit repo_overrides for that repo, otherwise edit org_defaults
  repoId?: string;
  sensitivity?: Sensitivity;
  trigger?: Partial<PreventAIFeatureTriggers>;
}

export function useUpdatePreventAIFeature() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {mutateAsync, isPending, error} = useMutation({
    mutationFn: async (params: UpdatePreventAIFeatureParams) => {
      const newConfig = makePreventAIConfig(params.originalConfig, params);

      return fetchMutation<{
        default_org_config: PreventAIConfig;
        organization: PreventAIConfig;
      }>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/prevent/ai/github/config/${params.gitOrgName}/`,
        data: newConfig as unknown as Record<string, unknown>,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          `/organizations/${organization.slug}/prevent/ai/github/config/${variables.gitOrgName}/`,
        ],
      });
    },
  });

  return {
    enableFeature: mutateAsync,
    isLoading: isPending,
    error: error?.message,
  };
}

/**
 * Makes a new PreventAIConfig object with feature settings applied for the specified repo or org defaults
 * 1. Deep clones the original config to prevent mutation
 * 2. If editing repo, get the repo override for the specified repo or create it from org_defaults template if not exists
 * 3. Modifies the specified feature's settings, preserves any unspecified settings.
 * 4. Special case: 'use_org_defaults' feature type will remove the entire repo override
 *
 * @param originalConfig Original PreventAIConfig object (will not be mutated)
 * @param params Parameters to update
 * @returns New (copy of) PreventAIConfig object with updates applied
 */
export function makePreventAIConfig(
  originalConfig: PreventAIConfig,
  params: UpdatePreventAIFeatureParams
): PreventAIConfig {
  const updatedConfig = structuredClone(originalConfig);
  if (!updatedConfig.schema_version) {
    updatedConfig.schema_version = PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT;
  }

  if (!updatedConfig.repo_overrides) {
    updatedConfig.repo_overrides = {};
  }

  if (params.feature === 'use_org_defaults') {
    if (!params.repoId) {
      throw new Error('Repo name is required when feature is use_org_defaults');
    }
    if (params.enabled) {
      delete updatedConfig.repo_overrides[params.repoId];
    } else {
      updatedConfig.repo_overrides[params.repoId] = structuredClone(
        updatedConfig.org_defaults
      );
    }
    return updatedConfig;
  }

  let featureConfig = updatedConfig.org_defaults;
  if (params.repoId) {
    let repoOverride = updatedConfig.repo_overrides[params.repoId];
    if (!repoOverride) {
      repoOverride = structuredClone(updatedConfig.org_defaults);
      updatedConfig.repo_overrides[params.repoId] = repoOverride;
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
