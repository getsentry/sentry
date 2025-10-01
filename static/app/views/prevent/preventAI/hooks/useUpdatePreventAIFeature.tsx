import {updateOrganization} from 'sentry/actionCreators/organizations';
import type {
  PreventAIConfig,
  PreventAIFeatureTriggers,
  PreventAIOrgConfig,
} from 'sentry/types/prevent';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface UpdatePreventAIFeatureParams {
  enabled: boolean;
  feature: 'vanilla' | 'test_generation' | 'bug_prediction';
  orgName: string;
  repoName?: string;
  trigger?: Partial<PreventAIFeatureTriggers>;
}

export function useUpdatePreventAIFeature() {
  const api = useApi();
  const organization = useOrganization();

  const tempPatch: PreventAIConfig = {
    github_organizations: {
      'org-1': organization.preventAiConfigGithub as unknown as PreventAIOrgConfig,
      'org-2': organization.preventAiConfigGithub as unknown as PreventAIOrgConfig,
    },
    default_org_config:
      organization.preventAiConfigGithub as unknown as PreventAIOrgConfig,
  };
  const patchedOrganization = {...organization, preventAiConfigGithub: tempPatch};

  const {mutateAsync, isPending, error} = useMutation({
    mutationFn: async (params: UpdatePreventAIFeatureParams) => {
      if (!organization.preventAiConfigGithub) {
        throw new Error('Organization has no prevent AI config');
      }
      const editableConfig = structuredClone(patchedOrganization.preventAiConfigGithub);

      const editableOrgConfig =
        editableConfig.github_organizations[params.orgName] ??
        structuredClone(editableConfig.default_org_config);
      editableConfig.github_organizations[params.orgName] = editableOrgConfig;

      let editableFeatureConfig = editableOrgConfig.org_defaults;
      if (params.repoName) {
        const overrides = editableOrgConfig.repo_overrides[params.repoName];
        if (overrides) {
          editableFeatureConfig = overrides;
        }
      }

      editableFeatureConfig[params.feature] = {
        enabled: params.enabled,
        triggers: {...editableFeatureConfig[params.feature].triggers, ...params.trigger},
        sensitivity: editableFeatureConfig[params.feature].sensitivity,
      };

      const tempPatched = editableConfig.github_organizations['org-1'];

      return api.requestPromise(`/organizations/${organization.slug}/`, {
        method: 'PUT',
        data: {preventAiConfigGithub: tempPatched},
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
