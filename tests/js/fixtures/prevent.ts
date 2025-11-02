import type {PreventAIConfig, Sensitivity} from 'sentry/types/prevent';

export function PreventAIConfigFixture(): PreventAIConfig {
  return {
    schema_version: 'v1',
    org_defaults: {
      bug_prediction: {
        enabled: false,
        triggers: {on_command_phrase: false, on_ready_for_review: false},
        sensitivity: 'medium' as Sensitivity,
      },
      test_generation: {
        enabled: false,
        triggers: {on_command_phrase: false, on_ready_for_review: false},
        sensitivity: 'medium' as Sensitivity,
      },
      vanilla: {
        enabled: false,
        triggers: {on_command_phrase: false, on_ready_for_review: false},
        sensitivity: 'medium' as Sensitivity,
      },
    },
    repo_overrides: {},
  };
}
