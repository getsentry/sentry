import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useApiQueries, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export interface UseDetectorsQueryOptions {
  query?: string;
  sortBy?: string;
}
export function useDetectorsQuery(_options: UseDetectorsQueryOptions = {}) {
  const org = useOrganization();
  return useApiQuery<Detector[]>(makeDetectorQueryKey(org.slug), {
    staleTime: 0,
    retry: false,
  });
}

export const makeDetectorQueryKey = (orgSlug: string, detectorId = ''): [url: string] => [
  `/organizations/${orgSlug}/detectors/${detectorId ? `${detectorId}/` : ''}`,
];

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
