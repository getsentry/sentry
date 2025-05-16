import {DataConditionGroupFixture} from 'sentry-fixture/dataConditions';
import {UserFixture} from 'sentry-fixture/user';

import type {DataSource} from 'sentry/types/workflowEngine/dataConditions';
import type {Detector} from 'sentry/types/workflowEngine/detectors';

export function DetectorFixture(params: Partial<Detector>): Detector {
  return {
    id: '1',
    name: 'detector',
    projectId: '1',
    createdBy: UserFixture().id,
    dateCreated: '2025-01-01T00:00:00.000Z',
    dateUpdated: '2025-01-01T00:00:00.000Z',
    lastTriggered: '2025-01-01T00:00:00.000Z',
    workflowIds: [],
    config: {},
    type: 'metric',
    dataCondition: DataConditionGroupFixture({}),
    disabled: false,
    dataSource: params.dataSource ?? DetectorDataSource({}),
    ...params,
  };
}

export function DetectorDataSource(params: Partial<DataSource>): DataSource {
  return {
    id: '1',
    status: 1,
    snubaQuery: {
      aggregate: '',
      dataset: '',
      id: '',
      query: '',
      timeWindow: 60,
      ...params,
    },
  };
}
