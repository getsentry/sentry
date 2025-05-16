import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

function getDetectorQueryKey(
  organizationSlug: string,
  projectSlug: string,
  detectorId: string
): ApiQueryKey {
  return [`/projects/${organizationSlug}/${projectSlug}/detectors/${detectorId}/`];
}

interface UseDetectorOptions {
  detectorId: string;
  projectSlug: string;
}

export function useDetector({projectSlug, detectorId}: UseDetectorOptions) {
  const organization = useOrganization();
  return useApiQuery<Detector>(
    getDetectorQueryKey(organization.slug, projectSlug, detectorId),
    {
      staleTime: 0,
    }
  );
}
