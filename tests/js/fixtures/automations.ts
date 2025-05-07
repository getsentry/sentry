import { DataConditionGroupFixture } from "sentry-fixture/dataConditions";
import { Automation } from "sentry/types/workflowEngine/automations";

export function AutomationFixture(params: Partial<Automation>): Automation {
  return {
    id: '1',
    name: 'Automation',
    lastTriggered: new Date('2025-01-01T00:00:00.000Z'),
    actionFilters: [],
    detectorIds: [],
    triggers: DataConditionGroupFixture({}),
    ...params
  }
}
