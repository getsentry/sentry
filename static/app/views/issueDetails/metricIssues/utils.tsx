import {Fragment, useMemo} from 'react';
import moment from 'moment-timezone';

import {usePageFilterDates} from 'sentry/components/checkInTimeline/hooks/useMonitorDates';
import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import type {GroupOpenPeriod} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertRuleThresholdType,
  TimePeriod,
  TimeWindow,
} from 'sentry/views/alerts/rules/metric/types';
import {useIssueDetails} from 'sentry/views/issueDetails/context';

export function useMetricIssueDetectorId(): string | undefined {
  const {detectorDetails} = useIssueDetails();
  const {detectorId, detectorType} = detectorDetails;
  return detectorType === 'metric_alert' ? detectorId : undefined;
}

/**
 * Adapts a metric detector into the legacy `MetricRule` shape consumed by the
 * correlated issues/transactions views. Only the fields those views read are
 * populated with real values; the remaining required fields are filled with
 * inert defaults.
 */
export function getMetricRuleFromDetector(
  detector: MetricDetector,
  project: Project
): MetricRule {
  const {aggregate, dataset, query, environment, eventTypes, timeWindow} =
    detector.dataSources[0].queryObj.snubaQuery;

  return {
    aggregate,
    dataset,
    query,
    eventTypes,
    environment: environment ?? null,
    projects: [project.slug],
    detectionType: detector.config.detectionType,
    // snubaQuery time windows are in seconds; MetricRule expects minutes
    timeWindow: (timeWindow / 60) as TimeWindow,
    resolveThreshold: null,
    thresholdPeriod: null,
    thresholdType: AlertRuleThresholdType.ABOVE,
    triggers: [],
  };
}

interface UseMetricTimePeriodParams {
  openPeriod?: GroupOpenPeriod;
}

export function useMetricTimePeriod({
  openPeriod,
}: UseMetricTimePeriodParams = {}): TimePeriodType {
  const {since, until} = usePageFilterDates();
  return useMemo(() => {
    const start = openPeriod?.start ?? since.toISOString();
    let end = openPeriod?.end ?? until.toISOString();
    if (!end) {
      end = new Date().toISOString();
    }
    return {
      start,
      end,
      period: TimePeriod.SEVEN_DAYS,
      usingPeriod: false,
      label: t('Custom time'),
      display: (
        <Fragment>
          <DateTime date={moment.utc(start)} />
          {' — '}
          <DateTime date={moment.utc(end)} />
        </Fragment>
      ),
      custom: true,
    };
  }, [openPeriod, since, until]);
}
