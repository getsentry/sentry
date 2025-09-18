type PreventAIProvider = 'github' | 'bitbucket' | 'gitlab';

interface PreventAIRepo {
  fullName: string;
  id: string;
  name: string;
  url: string;
}

interface PreventAIOrg {
  id: string;
  name: string;
  provider: PreventAIProvider;
  repos: PreventAIRepo[];
}

type Feature = 'vanilla_pr_review' | 'bug_prediction' | 'test_generation';

type Trigger = 'on_command_phrase' | 'on_ready_for_review' | 'on_new_commit';

interface PreventAIConfig {
  features: Record<
    Feature,
    {
      enabled: boolean;
      triggers?: Trigger[];
    }
  >;
}

export type {Feature, Trigger, PreventAIConfig, PreventAIOrg, PreventAIRepo};
