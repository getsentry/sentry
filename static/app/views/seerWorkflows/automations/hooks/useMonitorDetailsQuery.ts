import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useDetectorResolvedStatsPeriod} from 'sentry/views/detectors/components/details/metric/utils/useDetectorTimePeriods';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';

/**
 * Query for a link to a metric monitor's page. Without a time range in the
 * URL, the monitor page loads the org's last-used page filters, which can be
 * a stale absolute range saved by a chart zoom somewhere else.
 */
export function useMonitorDetailsQuery(monitor: Detector | undefined) {
  const snubaQuery =
    monitor?.type === 'metric_issue'
      ? monitor.dataSources[0].queryObj.snubaQuery
      : undefined;

  const statsPeriod = useDetectorResolvedStatsPeriod({
    dataset: snubaQuery
      ? getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes)
      : undefined,
    intervalSeconds: snubaQuery?.timeWindow,
  });

  return {statsPeriod};
}
