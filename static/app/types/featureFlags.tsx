type RolloutEvaluation = {
  result: boolean;
  type: 'rollout';
  percentage?: number;
  tags?: Record<string, string>;
};

type MatchEvaluation = {
  result: boolean;
  type: 'match';
  tags?: Record<string, string>;
};

export type FeatureFlagEvaluation = RolloutEvaluation | MatchEvaluation;

export type FeatureFlag = {
  enabled: boolean;
  evaluations: FeatureFlagEvaluation[];
  description?: string;
};

export type FeatureFlags = Record<string, FeatureFlag>;
