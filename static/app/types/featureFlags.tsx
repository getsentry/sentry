export enum EvaluationType {
  Rollout = 'rollout',
  Match = 'match',
}

export enum FeatureFlagKind {
  BOOLEAN = 'boolean',
  STRING = 'string',
  NUMBER = 'number',
  RATE = 'rate',
}

export type FeatureFlagSegment = {
  id: number;
  result: number | string | boolean;
  type: EvaluationType;
  payload?: string;
  percentage?: number;
  tags?: Record<string, string | string[]>;
};

export enum FeatureFlagSegmentTagKind {
  ENVIRONMENT = 'environment',
  RELEASE = 'release',
  TRANSACTION = 'transaction',
  CUSTOM = 'custom',
}

export type FeatureFlag = {
  custom: boolean;
  enabled: boolean;
  evaluation: FeatureFlagSegment[];
  kind: FeatureFlagKind;
  description?: string;
  group?: string;
  name?: string;
};

export type FeatureFlags = Record<string, FeatureFlag>;
