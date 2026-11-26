import type {
  ClassifierOutputConfig,
  PrebuiltClassifier,
} from 'sentry/views/classifiers/types';

type PrebuiltClassifierFixtureParams = Partial<
  Omit<PrebuiltClassifier, keyof ClassifierOutputConfig>
> &
  (ClassifierOutputConfig | {binaryThreshold?: never; outputType?: never});

export function PrebuiltClassifierFixture(
  params: PrebuiltClassifierFixtureParams = {}
): PrebuiltClassifier {
  return {
    key: 'user_frustration',
    dataset: 'conversation',
    name: 'User frustration',
    description: 'When your users become frustrated.',
    outputType: 'binary',
    binaryThreshold: 0.8,
    resultAttribute: 'user_frustration',
    ...params,
  };
}
