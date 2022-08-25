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
  tags?: Record<string, string | string[]>;
};

export enum FeatureFlagSegmentTagKind {
  ENVIRONMENT = 'environment',
  RELEASE = 'release',
  CUSTOM = 'custom',
}

export type FeatureFlag = {
  enabled: boolean;
  evaluation: FeatureFlagSegment[];
  kind: FeatureFlagKind;
  description?: string;
  group?: string;
};

export enum AddFlagDropDownType {
  PRE_DEFINED = 'pre_defined',
  CUSTOM = 'custom',
}

export type FeatureFlags = Record<string, FeatureFlag>;
