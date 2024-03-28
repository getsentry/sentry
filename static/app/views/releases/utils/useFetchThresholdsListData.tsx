import {MonitorType} from 'sentry/types/alerts';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';

import type {Threshold, ThresholdQuery} from './types';

export type HookProps = {
  selectedEnvs?: string[];
  selectedProjectIds?: number[];
};

export default function useFetchThresholdsListData({
  selectedEnvs = [],
  selectedProjectIds = [],
}: HookProps = {}) {
  const organization = useOrganization();
  const query: ThresholdQuery = {};
  const isActivatedAlert = organization.features?.includes('activated-alert-rules');

  if (selectedEnvs.length) query.environment = selectedEnvs;
  if (selectedProjectIds.length) {
    query.project = selectedProjectIds;
  } else {
    query.project = [-1];
  }

  let queryKey: ApiQueryKey = [
    `/organizations/${organization.slug}/release-thresholds/`,
    {
      query,
    },
  ];

  if (isActivatedAlert) {
    query.monitor_type = MonitorType.ACTIVATED;
    queryKey = [
      `/organizations/${organization.slug}/alert-rules/`,
      {
        query,
      },
    ];
  }

  const hasReleaseV2Feature =
    organization.features?.includes('releases-v2-internal') ||
    organization.features?.includes('releases-v2') ||
    organization.features?.includes('releases-v2-st');

  return useApiQuery<Threshold[] | MetricRule[]>(queryKey, {
    staleTime: 0,
    enabled: hasReleaseV2Feature || isActivatedAlert,
  });
}
