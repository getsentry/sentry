import {useMemo} from 'react';

import type {Environment} from 'sentry/types';
import {MonitorType} from 'sentry/types/alerts';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {TOTAL_ERROR_COUNT_STR} from 'sentry/views/releases/utils/constants';

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

  const {data, ...remainigProps} = useApiQuery<Threshold[] | MetricRule[]>(queryKey, {
    staleTime: 0,
    enabled: hasReleaseV2Feature || isActivatedAlert,
  });

  const thresholds: Threshold[] = useMemo(() => {
    if (!isActivatedAlert) return data as Threshold[];
    if (!data) return [];

    return data.map((thresholdOrRule: Threshold | MetricRule) => {
      const rule = thresholdOrRule as MetricRule;

      return {
        date_added: rule.dateCreated,
        environment: {
          name: rule.environment,
          displayName: rule.environment,
        } as Environment,
        id: rule.id,
        project: {id: rule.projects[0], slug: rule.projects[0]},
        threshold_type: TOTAL_ERROR_COUNT_STR,
        trigger_type: 'over',
        value: rule.triggers[0]?.alertThreshold,
        window_in_seconds: rule.timeWindow,
      } as Threshold;
    });
  }, [isActivatedAlert, data]);

  return {
    data: thresholds,
    ...remainigProps,
  };
}
