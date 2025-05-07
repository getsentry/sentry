import { Detector } from "sentry/types/workflowEngine/detectors";
import { UserFixture } from "sentry-fixture/user";
import { DataConditionGroupFixture } from "sentry-fixture/dataConditions";

export function DetectorFixture(params: Partial<Detector>): Detector {
    return {
      id: '1',
      name: 'detector',
      projectId: '1',
      createdBy: UserFixture().id,
      dateCreated: new Date('2025-01-01T00:00:00.000Z'),
      dateUpdated: new Date('2025-01-01T00:00:00.000Z'),
      lastTriggered: new Date('2025-01-01T00:00:00.000Z'),
      workflowIds: [],
      config: {},
      type: 'metric',
      dataCondition: DataConditionGroupFixture({}),
      disabled: false,
      dataSource: {
        id: '1',
        status: 1,
        snubaQuery: {
          aggregate: '',
          dataset: '',
          id: '',
          query: '',
          timeWindow: 60,
          ...(params.dataSource?.snubaQuery ?? {}),
        },
        ...(params.dataSource ?? {}),
      },
      ...params,
    };
}
