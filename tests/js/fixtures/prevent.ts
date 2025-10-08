export function PreventAIConfigFixture() {
  return {
    schema_version: 'v1',
    github_organizations: {},
    default_org_config: {
      org_defaults: {
        bug_prediction: {
          enabled: false,
          triggers: {on_command_phrase: false, on_ready_for_review: false},
          sensitivity: 'medium',
        },
        test_generation: {
          enabled: false,
          triggers: {on_command_phrase: false, on_ready_for_review: false},
          sensitivity: 'medium',
        },
        vanilla: {
          enabled: false,
          triggers: {on_command_phrase: false, on_ready_for_review: false},
          sensitivity: 'medium',
        },
      },
      repo_overrides: {},
    },
  };
}
