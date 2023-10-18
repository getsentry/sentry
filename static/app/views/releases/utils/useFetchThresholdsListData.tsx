import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {Threshold, ThresholdQuery} from './types';

export type HookProps = {
  selectedEnvs: string[];
  selectedProjects: number[];
};

export default function useFetchThresholdsListData({
  selectedEnvs,
  selectedProjects,
}: HookProps) {
  const organization = useOrganization();

  const query: ThresholdQuery = {};
  if (selectedProjects.length) {
    query.project = selectedProjects;
  } else {
    query.project = [-1];
  }
  if (selectedEnvs.length) {
    query.environment = selectedEnvs;
  }

  return useApiQuery<Threshold[]>(
    [
      `/organizations/${organization.id}/release-thresholds/`,
      {
        query,
      },
    ],
    {
      staleTime: 0,
      enabled: organization.features?.includes('event-attachments') ?? false,
    }
  );
}
