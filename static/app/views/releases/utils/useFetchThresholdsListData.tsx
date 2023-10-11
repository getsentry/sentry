import {useCallback, useEffect, useState} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {Threshold, ThresholdQuery} from './types';

export const EMPTY_THRESHOLDS_LIST_DATA: ReturnType<typeof useFetchThresholdsListData> = {
  errors: null,
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
  const api = useApi();
  const organization = useOrganization();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errors, setErrors] = useState<string | null>();
  const [_featureEnabledFlag, setFeatureEnabledFlag] = useState<boolean>(true);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);

  const fetchThresholds = useCallback(async () => {
    //     ReleaseThresholdIndexEndpoint.as_view(),
    //     name="sentry-api-0-organization-release-thresholds",
    const path = `/organizations/${organization.id}/releases/thresholds/`;
    const query: ThresholdQuery = {};
    if (selectedProjects.length) {
      query.project = selectedProjects;
    } else {
      query.project = [-1];
    }
    if (selectedEnvs.length) {
      query.environment = selectedEnvs;
    }
    try {
      setIsLoading(true);
      const resp = await api.requestPromise(path, {
        method: 'GET',
        query,
      });
      setThresholds(resp);
    } catch (err) {
      if (err.status === 404) {
        setErrors('Error fetching release thresholds');
      } else if (err.status === 403) {
        // NOTE: If release thresholds are not enabled, API will return a 403 not found
        // So capture this case and set enabled to false
        setFeatureEnabledFlag(false);
      } else {
        setErrors(err.statusText);
      }
    }
    setIsLoading(false);
  }, [api, organization, selectedEnvs, selectedProjects]);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds, selectedEnvs, selectedProjects]);

  return {
    errors,
    isLoading,
    thresholds,
  };
}
