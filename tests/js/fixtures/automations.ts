import {DataConditionGroupFixture} from 'sentry-fixture/dataConditions';

import type {Automation} from 'sentry/types/workflowEngine/automations';

export function AutomationFixture(params: Partial<Automation>): Automation {
  return {
    id: '1',
    name: 'Automation',
    lastTriggered: '2025-01-01T00:00:00.000Z',
    actionFilters: [],
    detectorIds: [],
    triggers: DataConditionGroupFixture({}),
    ...params,
  };
}
