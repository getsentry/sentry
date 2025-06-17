import {DataConditionGroupFixture} from 'sentry-fixture/dataConditions';
import {UserFixture} from 'sentry-fixture/user';

import type {Detector, SnubaQueryDataSource} from 'sentry/types/workflowEngine/detectors';

export function DetectorFixture(params: Partial<Detector> = {}): Detector {
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
      detection_type: 'static',
      threshold_period: 1,
    },
    type: 'metric_issue',
    disabled: false,
    conditionGroup: params.conditionGroup ?? DataConditionGroupFixture(),
    dataSources: params.dataSources ?? [SnubaQueryDataSourceFixture()],
    owner: null,
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
        dataset: '',
        id: '',
        query: '',
        timeWindow: 60,
      },
    },
    ...params,
  };
}
