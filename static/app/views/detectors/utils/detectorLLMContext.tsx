import type {Detector, MetricConditionGroup} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';
import {UptimeMonitorMode} from 'sentry/views/detectors/components/uptime/types';
import {getDetectorEnvironment} from 'sentry/views/detectors/utils/getDetectorEnvironment';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';
import {percentThresholdAbsoluteToDelta} from 'sentry/views/detectors/utils/percentThreshold';

/**
 * Flatten a detector's condition group into the thresholds it represents.
 *
 * Percent-change detectors store their comparison as an absolute percentage of
 * the baseline — 110 means "10% higher" — so those are converted to the delta
 * the page displays. Everything else passes through: static thresholds are
 * plain numbers, and anomaly detection's comparison is an object.
 */
function summarizeConditions(
  group: MetricConditionGroup | null,
  isPercentChange = false
) {
  if (!group) {
    return null;
  }
  return {
    logicType: group.logicType,
    conditions: group.conditions.map(condition => ({
      type: condition.type,
      comparison:
        isPercentChange && typeof condition.comparison === 'number'
          ? percentThresholdAbsoluteToDelta(condition.comparison)
          : condition.comparison,
      priority: condition.conditionResult,
    })),
  };
}

/**
 * The configuration a monitor reports to Seer, narrowed per detector type to
 * the fields its detail page actually displays.
 *
 * Fields are listed explicitly rather than spreading `config` and
 * `dataSources[0].queryObj`, and that is deliberate on two counts. An uptime
 * subscription carries `headers` and `body`, which routinely hold auth
 * credentials; a cron data source is an entire `Monitor`, including its project
 * and every environment's recent check-in state. Neither belongs in a prompt.
 *
 * `dataSources` is read through `?.` despite its tuple type: the API returns it
 * null often enough that `insights/uptime/.../overviewRow.tsx` guards for it,
 * and reporting page context must not throw during render.
 */
function getDetectorConfig(detector: Detector): Record<string, unknown> {
  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue': {
      const snubaQuery = detector.dataSources?.[0]?.queryObj?.snubaQuery;
      const {detectionType} = detector.config;
      return {
        detectionType,
        comparisonDelta:
          'comparisonDelta' in detector.config ? detector.config.comparisonDelta : null,
        // Without a unit, a threshold of 500 could be milliseconds or a count.
        thresholdSuffix: getMetricDetectorSuffix(
          detectionType,
          snubaQuery?.aggregate ?? ''
        ),
        thresholds: summarizeConditions(
          detector.conditionGroup,
          detectionType === 'percent'
        ),
        ...(snubaQuery && {
          aggregate: snubaQuery.aggregate,
          dataset: snubaQuery.dataset,
          query: snubaQuery.query,
          eventTypes: snubaQuery.eventTypes,
          timeWindowSeconds: snubaQuery.timeWindow,
        }),
      };
    }
    case 'uptime_domain_failure': {
      const subscription = detector.dataSources?.[0]?.queryObj;
      return {
        downtimeThreshold: detector.config.downtimeThreshold,
        recoveryThreshold: detector.config.recoveryThreshold,
        autoDetected: detector.config.mode !== UptimeMonitorMode.MANUAL,
        ...(subscription && {
          url: subscription.url,
          method: subscription.method,
          intervalSeconds: subscription.intervalSeconds,
          timeoutMs: subscription.timeoutMs,
          traceSampling: subscription.traceSampling,
        }),
      };
    }
    case 'monitor_check_in_failure': {
      const monitor = detector.dataSources?.[0]?.queryObj;
      if (!monitor) {
        return {};
      }
      return {
        schedule: monitor.config.schedule,
        scheduleType: monitor.config.schedule_type,
        timezone: monitor.config.timezone,
        checkinMarginMinutes: monitor.config.checkin_margin,
        maxRuntimeMinutes: monitor.config.max_runtime,
        failureIssueThreshold: monitor.config.failure_issue_threshold ?? null,
        recoveryThreshold: monitor.config.recovery_threshold ?? null,
        status: monitor.status,
        // Crons are the one multi-environment type, so they list their own
        // environments rather than using the shared `environment` field.
        environments: monitor.environments.map(environment => environment.name),
      };
    }
    case 'preprod_size_analysis':
      return {
        measurement: detector.config.measurement,
        thresholdType: detector.config.thresholdType,
        query: detector.config.query ?? null,
        thresholds: summarizeConditions(detector.conditionGroup),
      };
    case 'error':
    case 'issue_stream':
      // No type-specific configuration. Identity fields still apply.
      return {};
    default:
      return unreachable(detectorType);
  }
}

/**
 * Everything the monitor detail page publishes about the monitor in view.
 * Identity fields are shared across every detector type; the rest comes from
 * the per-type config above.
 */
export function detectorToLLMContext(detector: Detector, projectSlug: string) {
  return {
    id: detector.id,
    name: detector.name,
    type: detector.type,
    enabled: detector.enabled,
    projectSlug,
    environment: getDetectorEnvironment(detector),
    owner: detector.owner
      ? {type: detector.owner.type, id: detector.owner.id, name: detector.owner.name}
      : null,
    description: detector.description,
    lastTriggered: detector.lastTriggered,
    // Alerts are `workflows` in the API but "alerts" in the product.
    connectedAlertIds: detector.workflowIds,
    config: getDetectorConfig(detector),
  };
}
