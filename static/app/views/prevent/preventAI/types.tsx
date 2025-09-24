// Add any new providers here e.g., 'github' | 'bitbucket' | 'gitlab'
type PreventAIProvider = 'github';

interface PreventAIRepo {
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

type Trigger = 'on_command_phrase' | 'on_ready_for_review' | 'on_new_commit';

export interface PreventAIConfig {
  features: {
    bug_prediction: {
      enabled: boolean;
      triggers: Record<Trigger, boolean>;
    };
    test_generation: {
      enabled: boolean;
    };
    vanilla: {
      enabled: boolean;
    };
  };
}
