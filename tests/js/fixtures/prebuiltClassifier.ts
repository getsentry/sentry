import type {PrebuiltClassifier} from 'sentry/views/classifiers/types';

export function PrebuiltClassifierFixture(
  params: Partial<PrebuiltClassifier> = {}
): PrebuiltClassifier {
  return {
    key: 'user_frustration',
    dataset: 'conversation',
    name: 'User frustration',
    description: 'When your users become frustrated.',
    resultAttribute: 'user_frustration',
    ...params,
  };
}
