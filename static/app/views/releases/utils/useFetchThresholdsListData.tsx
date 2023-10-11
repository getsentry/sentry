import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {Threshold, ThresholdQuery} from './types';

export const EMPTY_THRESHOLDS_LIST_DATA: ReturnType<typeof useFetchThresholdsListData> = {
  isError: false,
  isLoading: false,
  thresholds: [],
};

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

  const {
    data: thresholds,
    isLoading,
    isError,
  } = useApiQuery<Threshold[]>(
    [
      `/organizations/${organization.id}/releases/thresholds/`,
      {
        query,
      },
    ],
    {staleTime: 0}
  );

  return {
    isError,
    isLoading,
    thresholds,
  };
}
