import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

import {
  classifierDetailsApiOptions,
  classifierListApiOptions,
} from './classifierApiOptions';

export function useClassifier(classifierId: string) {
  const organization = useOrganization();
  return useQuery(classifierDetailsApiOptions(organization.slug, classifierId));
}

type UpdateClassifierPayload = Partial<Pick<TelemetryClassifier, 'status'>>;

export function useUpdateClassifier(classifierId: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const options = classifierDetailsApiOptions(organization.slug, classifierId);

  return useMutation({
    mutationFn: (data: UpdateClassifierPayload) =>
      fetchMutation<TelemetryClassifier>({url: options.queryKey[0], method: 'PUT', data}),
    onSuccess: classifier => {
      queryClient.setQueryData(options.queryKey, prev =>
        prev ? {...prev, json: classifier} : prev
      );
    },
  });
}

export function useDeleteClassifier(classifierId: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchMutation<void>({
        url: classifierDetailsApiOptions(organization.slug, classifierId).queryKey[0],
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [classifierListApiOptions(organization.slug).queryKey[0]],
      });
    },
  });
}
