import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';
import type {ClassifierDataset} from 'sentry/views/classifiers/types';

import {prebuiltClassifiersApiOptions} from './classifierApiOptions';

export function usePrebuiltClassifiers(
  dataset: ClassifierDataset,
  {enabled = true}: {enabled?: boolean} = {}
) {
  const organization = useOrganization();
  return useQuery({
    ...prebuiltClassifiersApiOptions(organization.slug, dataset),
    enabled,
  });
}
