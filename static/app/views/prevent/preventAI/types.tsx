// note: we only support github for now
export type PreventAIProvider = 'github' | 'bitbucket' | 'gitlab';

export interface PreventAIRepo {
  fullName: string;
  id: string;
  name: string;
  url: string;
}

export interface PreventAIOrg {
  id: string;
  name: string;
  provider: PreventAIProvider;
  repos: PreventAIRepo[];
}

export type Feature = 'vanilla_pr_review' | 'bug_prediction' | 'test_generation';

export type Trigger = 'on_command_phrase' | 'on_ready_for_review' | 'on_new_commit';

export interface PreventAIConfig {
  features: {
    bug_prediction: {
      enabled: boolean;
      triggers: Record<Trigger, boolean>;
    };
    test_generation: {
      enabled: boolean;
    };
    vanilla_pr_review: {
      enabled: boolean;
    };
  };
}
