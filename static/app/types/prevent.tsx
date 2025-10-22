// Add any new providers here e.g., 'github' | 'bitbucket' | 'gitlab'
export type PreventAIProvider = 'github';

export type Sensitivity = 'low' | 'medium' | 'high' | 'critical';

export interface PreventAIRepo {
  fullName: string;
  id: string;
  name: string;
}

export interface PreventAIOrg {
  githubOrganizationId: string;
  name: string;
  provider: PreventAIProvider;
  repos: PreventAIRepo[];
}

interface PreventAIFeatureConfig {
  enabled: boolean;
  triggers: PreventAIFeatureTriggers;
  sensitivity?: Sensitivity;
}

export interface PreventAIFeatureTriggers {
  on_command_phrase: boolean;
  on_ready_for_review: boolean;
}

export interface PreventAIFeatureConfigsByName {
  bug_prediction: PreventAIFeatureConfig;
  test_generation: PreventAIFeatureConfig;
  vanilla: PreventAIFeatureConfig; // "vanilla" basic ai pr review
}

export interface PreventAIOrgConfig {
  org_defaults: PreventAIFeatureConfigsByName;
  repo_overrides: Record<string, PreventAIFeatureConfigsByName>;
}

export interface PreventAIConfig {
  default_org_config: PreventAIOrgConfig;
  github_organizations: Record<string, PreventAIOrgConfig>;
  schema_version: string;
}
