import {EvaluationType, FeatureFlagKind} from 'sentry/types/featureFlags';

export const preDefinedFeatureFlags = {
  sampleRate: {
    description: 'This is a description',
    enabled: false,
    custom: false,
    kind: FeatureFlagKind.NUMBER,
    group: '',
    evaluation: [
      {
        id: 1,
        type: EvaluationType.Rollout,
        tags: {
          environment: 'production',
        },
        percentage: 1.0,
        result: 0.5,
      },
    ],
  },
  tracesSampleRate: {
    description: 'This is a description',
    enabled: false,
    custom: false,
    kind: FeatureFlagKind.NUMBER,
    group: '',
    evaluation: [
      {
        id: 1,
        type: EvaluationType.Rollout,
        tags: {
          environment: 'production',
        },
        percentage: 1.0,
        result: 0.1,
      },
    ],
  },
};
