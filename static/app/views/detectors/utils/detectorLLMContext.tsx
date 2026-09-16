import type {Detector, MetricConditionGroup} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';

/**
 * Flatten a detector's condition group into the thresholds it represents.
 *
 * `comparison` is a number for static thresholds and an object for anomaly
 * detection; both are JSON-serializable, so it passes through as-is.
 */
function summarizeConditions(group: MetricConditionGroup | null) {
  if (!group) {
    return null;
  }
  return {
    logicType: group.logicType,
    conditions: group.conditions.map(condition => ({
      type: condition.type,
      comparison: condition.comparison,
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
 */
function getDetectorConfig(detector: Detector): Record<string, unknown> {
  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue': {
      const {snubaQuery} = detector.dataSources[0].queryObj;
      return {
        aggregate: snubaQuery.aggregate,
        dataset: snubaQuery.dataset,
        query: snubaQuery.query,
        eventTypes: snubaQuery.eventTypes,
        environment: snubaQuery.environment ?? null,
        timeWindowSeconds: snubaQuery.timeWindow,
        detectionType: detector.config.detectionType,
        comparisonDelta:
          'comparisonDelta' in detector.config ? detector.config.comparisonDelta : null,
        thresholds: summarizeConditions(detector.conditionGroup),
      };
    }
    case 'uptime_domain_failure': {
      const subscription = detector.dataSources[0].queryObj;
      return {
        url: subscription.url,
        method: subscription.method,
        intervalSeconds: subscription.intervalSeconds,
        timeoutMs: subscription.timeoutMs,
        traceSampling: subscription.traceSampling,
        downtimeThreshold: detector.config.downtimeThreshold,
        recoveryThreshold: detector.config.recoveryThreshold,
        mode: detector.config.mode,
        environment: detector.config.environment,
      };
    }
    case 'monitor_check_in_failure': {
      const monitor = detector.dataSources[0].queryObj;
      return {
        schedule: monitor.config.schedule,
        scheduleType: monitor.config.schedule_type,
        timezone: monitor.config.timezone,
        checkinMarginMinutes: monitor.config.checkin_margin,
        maxRuntimeMinutes: monitor.config.max_runtime,
        failureIssueThreshold: monitor.config.failure_issue_threshold ?? null,
        recoveryThreshold: monitor.config.recovery_threshold ?? null,
        status: monitor.status,
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
      unreachable(detectorType);
      return {};
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
    project: projectSlug,
    owner: detector.owner ? `${detector.owner.type}:${detector.owner.name}` : null,
    description: detector.description,
    lastTriggered: detector.lastTriggered,
    // Alerts are `workflows` in the API but "alerts" in the product.
    connectedAlertIds: detector.workflowIds,
    config: getDetectorConfig(detector),
  };
}
