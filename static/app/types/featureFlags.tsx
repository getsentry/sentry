export enum EvaluationType {
  Rollout = 'rollout',
  Match = 'match',
}

export enum FeatureFlagKind {
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
  kind: FeatureFlagKind;
  description?: string;
};

export type FeatureFlags = Record<string, FeatureFlag>;
