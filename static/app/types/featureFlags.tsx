export enum EvaluationType {
  Rollout = 'rollout',
  Match = 'match',
}

export enum FeatureFlagResultType {
  BOOLEAN = 'boolean',
  STRING = 'string',
  NUMBER = 'number',
}

export type FeatureFlagSegment = {
  id: number;
  result: number | string | boolean;
  type: EvaluationType;
  percentage?: number;
  tags?: Record<string, string>;
};

export type FeatureFlag = {
  enabled: boolean;
  evaluation: FeatureFlagSegment[];
  resultType: FeatureFlagResultType;
  description?: string;
};

export type FeatureFlags = Record<string, FeatureFlag>;
