import {DataConditionGroupFixture} from 'sentry-fixture/dataConditions';
import {SimpleGroupFixture} from 'sentry-fixture/group';
import {UserFixture} from 'sentry-fixture/user';

import type {
  CronDetector,
  CronSubscriptionDataSource,
  ErrorDetector,
  MetricDetector,
  SnubaQueryDataSource,
  UptimeDetector,
  UptimeSubscriptionDataSource,
} from 'sentry/types/workflowEngine/detectors';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';

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
};

export function MetricDetectorFixture(
  params: Partial<MetricDetector> = {}
): MetricDetector {
  return {
    ...BASE_DETECTOR,
    id: '1',
    name: 'detector',
    config: {
      detectionType: 'static',
      thresholdPeriod: 1,
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
        query: '',
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
    config: {
      environment: 'production',
    },
    dataSources: [CronSubscriptionDataSourceFixture()],
    ...params,
  };
}

function CronSubscriptionDataSourceFixture(
  params: Partial<CronSubscriptionDataSource> = {}
): CronSubscriptionDataSource {
  return {
    id: '1',
    organizationId: '1',
    sourceId: '1',
    type: 'cron_subscription',
    queryObj: {
      checkinMargin: null,
      failureIssueThreshold: 1,
      recoveryThreshold: 2,
      maxRuntime: null,
      schedule: '0 0 * * *',
      scheduleType: 'crontab',
      timezone: 'UTC',
    },
    ...params,
  };
}
