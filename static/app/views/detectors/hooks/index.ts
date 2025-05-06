import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {
  useApiQueries,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export interface UseDetectorsQueryOptions {
  query?: string;
  sort?: string;
}
export function useDetectorsQuery(
  projectId: string,
  _options: UseDetectorsQueryOptions = {}
) {
  const org = useOrganization();
  return useApiQuery<Detector[]>([`/projects/${org.slug}/${projectId}/detectors/`], {
    staleTime: 0,
    retry: false,
  });
}

export const makeDetectorQueryKey = (orgSlug: string, detectorId = ''): [url: string] => [
  `/organizations/${orgSlug}/detectors/${detectorId ? `${detectorId}/` : ''}`,
];

export function useCreateDetector(detector: Detector) {
  const org = useOrganization();

  return useApiQuery<Detector>(
    [...makeDetectorQueryKey(org.slug), {method: 'POST', data: detector}],
    {
      staleTime: 0,
      retry: false,
    }
  );
}

export function useDetectorQuery(detectorId: string) {
  const org = useOrganization();

  return useApiQuery<Detector>(makeDetectorQueryKey(org.slug, detectorId), {
    staleTime: 0,
    retry: false,
  });
}

export function useDetectorQueriesByIds(detectorId: string[]) {
  const org = useOrganization();

  return useApiQueries<Detector>(
    detectorId.map(id => makeDetectorQueryKey(org.slug, id)),
    {
      staleTime: 0,
      retry: false,
    }
  );
}

export function useDetectorMutation(detector: Partial<Detector> & {id: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const org = useOrganization();
  const queryKey = makeDetectorQueryKey(org.slug, detector.id);
  return useMutation<Detector>({
    mutationFn: data =>
      api.requestPromise(queryKey[0], {
        method: 'PUT',
        data,
      }),
    onSuccess: _ => {
      queryClient.invalidateQueries({queryKey});
      // setApiQueryData<Project>(
      //   queryClient,
      //   makeDetailedProjectQueryKey({
      //     orgSlug: organization.slug,
      //     projectSlug: project.slug,
      //   }),
      //   existingData => (updatedProject ? updatedProject : existingData)
      // );
      // return onSuccess?.(updatedProject);

      // eslint-disable-next-line no-console
      console.log('updated detector');
    },
    onError: error => {
      // eslint-disable-next-line no-console
      console.error('error updating detector', error);
    },
  });
}
