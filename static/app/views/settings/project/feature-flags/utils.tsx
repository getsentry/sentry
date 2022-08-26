import {t} from 'sentry/locale';
import {
  EvaluationType,
  FeatureFlagKind,
  FeatureFlagSegmentTagKind,
} from 'sentry/types/featureFlags';

export function getCustomTagLabel(tagKey: string) {
  return `${tagKey} - ${t('Custom')}`;
}

export function isCustomTag(tagKey: string) {
  return ![
    FeatureFlagSegmentTagKind.RELEASE,
    FeatureFlagSegmentTagKind.ENVIRONMENT,
    FeatureFlagSegmentTagKind.TRANSACTION,
    FeatureFlagSegmentTagKind.CUSTOM,
  ].includes(tagKey as FeatureFlagSegmentTagKind);
}

export const preDefinedFeatureFlags = {
  '@@sampleRate': {
    humanReadableName: 'Error Sample Rate',
    description: 'The sample rate for Sentry errors.',
    enabled: false,
    custom: false,
    kind: FeatureFlagKind.RATE,
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
    kind: FeatureFlagKind.RATE,
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
    kind: FeatureFlagKind.RATE,
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
