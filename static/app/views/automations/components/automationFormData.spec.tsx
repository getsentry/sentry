import {DataConditionGroupLogicType} from 'sentry/types/workflowEngine/dataConditions';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {
  type AutomationFormData,
  validateAutomationBuilderState,
} from 'sentry/views/automations/components/automationFormData';
import {CONNECTED_MONITORS_ERROR_ID} from 'sentry/views/automations/components/editConnectedMonitors';

describe('validateAutomationBuilderState', () => {
  const state: AutomationBuilderState = {
    triggers: {
      id: 'when',
      logicType: DataConditionGroupLogicType.ANY,
      conditions: [],
    },
    actionFilters: [],
  };

  it('allows all projects without project or detector IDs', () => {
    const data: AutomationFormData = {
      allProjects: true,
      detectorIds: [],
      enabled: true,
      environment: null,
      frequency: 0,
      name: 'All projects alert',
      projectIds: [],
    };

    expect(validateAutomationBuilderState(state, data)).not.toHaveProperty(
      CONNECTED_MONITORS_ERROR_ID
    );
  });
});
