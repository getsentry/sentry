import {DataConditionGroupFixture} from 'sentry-fixture/dataConditions';
import {UserFixture} from 'sentry-fixture/user';

import type {
  ErrorDetector,
  MetricDetector,
  SnubaQueryDataSource,
} from 'sentry/types/workflowEngine/detectors';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';

export function MetricDetectorFixture(
  params: Partial<MetricDetector> = {}
): MetricDetector {
  return {
    id: '1',
    name: 'detector',
    projectId: '1',
    createdBy: UserFixture().id,
    dateCreated: '2025-01-01T00:00:00.000Z',
    dateUpdated: '2025-01-01T00:00:00.000Z',
    lastTriggered: '2025-01-01T00:00:00.000Z',
    workflowIds: [],
    config: {
      detectionType: 'static',
      thresholdPeriod: 1,
    },
    type: 'metric_issue',
    disabled: false,
    conditionGroup: params.conditionGroup ?? DataConditionGroupFixture(),
    dataSources: params.dataSources ?? [SnubaQueryDataSourceFixture()],
    owner: null,
    ...params,
  };
}

export function ErrorDetectorFixture(params: Partial<ErrorDetector> = {}): ErrorDetector {
  return {
    name: 'Error Detector',
    createdBy: null,
    dateCreated: '2025-01-01T00:00:00.000Z',
    dateUpdated: '2025-01-01T00:00:00.000Z',
    disabled: false,
    id: '1',
    lastTriggered: '2025-01-01T00:00:00.000Z',
    owner: null,
    projectId: '1',
    workflowIds: [],
    type: 'error',
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
        aggregate: '',
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
