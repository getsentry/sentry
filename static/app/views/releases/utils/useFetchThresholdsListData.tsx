import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {Threshold, ThresholdQuery} from './types';

export type HookProps = {
  selectedEnvs?: string[];
  selectedProjectIds?: number[];
};

export default function useFetchThresholdsListData({
  selectedEnvs = [],
  selectedProjectIds = [],
}: HookProps) {
  const organization = useOrganization();

  const query: ThresholdQuery = {};
  if (selectedProjectIds.length) {
    query.project = selectedProjectIds;
  } else {
    query.project = [-1];
  }
  if (selectedEnvs.length) {
    query.environment = selectedEnvs;
  }

  return useApiQuery<Threshold[]>(
    [
      `/organizations/${organization.slug}/release-thresholds/`,
      {
        query,
      },
    ],
    {
      staleTime: 0,
      enabled:
        (organization.features?.includes('releases-v2') ||
          organization.features?.includes('releases-v2-st')) ??
        false,
    }
  );
}
