import {ActorFixture} from 'sentry-fixture/actor';
import {SimpleGroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  CronDetector,
  CronMonitorDataSource,
  ErrorDetector,
  IssueStreamDetector,
  MetricCondition,
  MetricConditionGroup,
  MetricDetector,
  SnubaQueryDataSource,
  UptimeDetector,
  UptimeSubscriptionDataSource,
} from 'sentry/types/workflowEngine/detectors';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
  EventTypes,
} from 'sentry/views/alerts/rules/metric/types';
import {
  MonitorStatus,
  ScheduleType,
  type MonitorEnvironment,
} from 'sentry/views/insights/crons/types';

const BASE_DETECTOR = {
  workflowIds: [],
  createdBy: UserFixture().id,
  dateCreated: '2025-01-01T00:00:00.000Z',
  dateUpdated: '2025-01-01T00:00:00.000Z',
  lastTriggered: '2025-01-01T00:00:00.000Z',
  owner: null,
  projectId: '1',
  enabled: true,
  latestGroup: SimpleGroupFixture(),
  description: null,
};

function DataConditionFixture(params: Partial<MetricCondition> = {}): MetricCondition {
  return {
    type: DataConditionType.GREATER,
    comparison: 8,
    id: '1',
    conditionResult: DetectorPriorityLevel.HIGH,
    ...params,
  };
}

function AnomalyDetectionConditionFixture(
  params: Partial<MetricCondition> = {}
): MetricCondition {
  return DataConditionFixture({
    comparison: {
      sensitivity: AlertRuleSensitivity.HIGH,
      seasonality: 'auto',
      thresholdType: AlertRuleThresholdType.ABOVE_AND_BELOW,
    },
    ...params,
  });
}

function DataConditionGroupFixture(
  params: Partial<MetricConditionGroup> = {}
): MetricConditionGroup {
  return {
    conditions: [
      // HIGH priority condition
      DataConditionFixture(),
      // OK (resolution) condition - uses same comparison value with swapped operator
      DataConditionFixture({
        id: '2',
        type: DataConditionType.LESS_OR_EQUAL,
        conditionResult: DetectorPriorityLevel.OK,
      }),
    ],
    id: '1',
    logicType: DataConditionGroupLogicType.ANY,
    ...params,
  };
}

export function AnomalyDetectionConditionGroupFixture(
  params: Partial<MetricConditionGroup> = {}
): MetricConditionGroup {
  return DataConditionGroupFixture({
    conditions: [AnomalyDetectionConditionFixture()],
    ...params,
  });
}

export function MetricDetectorFixture(
  params: Partial<MetricDetector> = {}
): MetricDetector {
  return {
    ...BASE_DETECTOR,
    id: '1',
    name: 'detector',
    config: {
      detectionType: 'static',
    },
    type: 'metric_issue',
    enabled: true,
    conditionGroup: params.conditionGroup ?? DataConditionGroupFixture(),
    dataSources: params.dataSources ?? [SnubaQueryDataSourceFixture()],
    owner: null,
    alertRuleId: null,
    ...params,
  };
}

export function ErrorDetectorFixture(params: Partial<ErrorDetector> = {}): ErrorDetector {
  return {
    ...BASE_DETECTOR,
    name: 'Error Detector',
    id: '2',
    type: 'error',
    ...params,
  };
}

export function IssueStreamDetectorFixture(
  params: Partial<IssueStreamDetector> = {}
): IssueStreamDetector {
  return {
    ...BASE_DETECTOR,
    name: 'Issue Stream Detector',
    id: '4',
    type: 'issue_stream',
    ...params,
  };
}

export function UptimeDetectorFixture(
  params: Partial<UptimeDetector> = {}
): UptimeDetector {
  return {
    ...BASE_DETECTOR,
    name: 'Uptime Detector',
    id: '3',
    type: 'uptime_domain_failure',
    config: {
      environment: 'production',
      mode: 1,
      recoveryThreshold: 1,
      downtimeThreshold: 3,
    },
    dataSources: [UptimeSubscriptionDataSourceFixture()],
    ...params,
  };
}

function UptimeSubscriptionDataSourceFixture(
  params: Partial<UptimeSubscriptionDataSource> = {}
): UptimeSubscriptionDataSource {
  return {
    id: '1',
    organizationId: '1',
    sourceId: '1',
    type: 'uptime_subscription',
    queryObj: {
      body: null,
      headers: [],
      intervalSeconds: 60,
      method: 'GET',
      timeoutMs: 5000,
      traceSampling: false,
      url: 'https://example.com',
    },
    ...params,
  };
}

export function SnubaQueryDataSourceFixture(
  params: Partial<SnubaQueryDataSource> = {}
): SnubaQueryDataSource {
  return {
    id: '1',
    organizationId: '1',
    sourceId: '1',
    type: 'snuba_query_subscription',
    queryObj: {
      id: '1',
      status: 1,
      subscription: '1',
      snubaQuery: {
        aggregate: 'count()',
        dataset: Dataset.ERRORS,
        id: '',
        query: 'is:unresolved',
        timeWindow: 60,
        eventTypes: [EventTypes.ERROR],
      },
    },
    ...params,
  };
}

export function CronDetectorFixture(params: Partial<CronDetector> = {}): CronDetector {
  return {
    ...BASE_DETECTOR,
    name: 'Cron Detector',
    id: '3',
    type: 'monitor_check_in_failure',
    dataSources: [CronMonitorDataSourceFixture()],
    ...params,
  };
}

export function CronMonitorEnvironmentFixture(
  params: Partial<MonitorEnvironment> = {}
): MonitorEnvironment {
  return {
    dateCreated: '2023-01-01T00:10:00Z',
    isMuted: false,
    lastCheckIn: '2023-12-25T17:13:00Z',
    name: 'production',
    nextCheckIn: '2023-12-25T16:10:00Z',
    nextCheckInLatest: '2023-12-25T15:15:00Z',
    status: MonitorStatus.OK,
    activeIncident: null,
    ...params,
  };
}

export function CronMonitorDataSourceFixture(
  params: Partial<CronMonitorDataSource> = {}
): CronMonitorDataSource {
  return {
    id: '1',
    organizationId: '1',
    sourceId: '1',
    type: 'cron_monitor',
    queryObj: {
      id: 'uuid-foo',
      name: 'Test Monitor',
      dateCreated: '2023-01-01T00:00:00Z',
      owner: ActorFixture(),
      project: ProjectFixture(),
      config: {
        checkin_margin: null,
        failure_issue_threshold: 1,
        recovery_threshold: 2,
        max_runtime: null,
        timezone: 'UTC',
        schedule: '0 0 * * *',
        schedule_type: ScheduleType.CRONTAB,
      },
      isMuted: false,
      status: 'active',
      environments: [CronMonitorEnvironmentFixture()],
      isUpserting: false,
      slug: 'test-monitor',
    },
    ...params,
  };
}
