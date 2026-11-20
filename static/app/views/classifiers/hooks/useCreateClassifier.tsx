import {useMutation} from '@tanstack/react-query';

import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

import {classifierListApiOptions} from './classifierApiOptions';

type CreateClassifierPayload = Pick<
  TelemetryClassifier,
  'dataset' | 'filterQuery' | 'name' | 'prebuiltClassifierKey' | 'resultAttribute'
> & {project: number};

export function useCreateClassifier() {
  const organization = useOrganization();
  return useMutation({
    mutationFn: (data: CreateClassifierPayload) =>
      fetchMutation<TelemetryClassifier>({
        url: classifierListApiOptions(organization.slug).queryKey[0],
        method: 'POST',
        data,
      }),
  });
}
