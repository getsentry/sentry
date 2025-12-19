export type Sensitivity = 'low' | 'medium' | 'high' | 'critical';

interface PreventAIFeatureConfig {
  enabled: boolean;
  triggers: PreventAIFeatureTriggers;
  sensitivity?: Sensitivity;
}

export interface PreventAIFeatureTriggers {
  on_command_phrase: boolean;
  on_new_commit: boolean;
  on_ready_for_review: boolean;
}

export interface PreventAIFeatureConfigsByName {
  bug_prediction: PreventAIFeatureConfig;
  test_generation: PreventAIFeatureConfig;
  vanilla: PreventAIFeatureConfig; // "vanilla" basic ai pr review
}

export interface PreventAIConfig {
  org_defaults: PreventAIFeatureConfigsByName;
  repo_overrides: Record<string, PreventAIFeatureConfigsByName>;
  schema_version: string;
}

export const PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT = 'v1';
