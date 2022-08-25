import {EvaluationType, FeatureFlagKind} from 'sentry/types/featureFlags';

export const preDefinedFeatureFlags = {
  '@@sampleRate': {
    humanReadableName: 'Error Sample Rate',
    description: 'The sample rate for Sentry errors.',
    enabled: false,
    custom: false,
    kind: FeatureFlagKind.NUMBER,
    group: '',
    evaluation: [
      {
        id: 1,
        type: EvaluationType.Match,
        tags: {},
        result: 1.0,
      },
    ],
  },
  '@@tracesSampleRate': {
    humanReadableName: 'Trace Sample Rate',
    description: 'The sample rate for specific transaction initiated traces.',
    enabled: false,
    custom: false,
    kind: FeatureFlagKind.NUMBER,
    group: '',
    evaluation: [
      {
        id: 1,
        type: EvaluationType.Match,
        tags: {},
        result: 0.1,
      },
    ],
  },
  '@@profileSampleRate': {
    humanReadableName: 'Profiling Sample Rate',
    description: 'The sample rate for client side profiling.',
    enabled: false,
    custom: false,
    kind: FeatureFlagKind.NUMBER,
    group: '',
    evaluation: [
      {
        id: 1,
        type: EvaluationType.Match,
        tags: {},
        result: 0.05,
      },
    ],
  },
};
