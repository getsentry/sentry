import {ActionFilterFixture, DataConditionFixture} from 'sentry-fixture/automations';

import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {
  type AutomationFormData,
  getAlertPreviewRequest,
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

describe('getAlertPreviewRequest', () => {
  it('waits for incomplete filter settings', () => {
    const condition = DataConditionFixture({
      type: DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL,
      comparison: null,
    });
    const state: AutomationBuilderState = {
      triggers: {
        id: 'triggers',
        logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
        conditions: [
          DataConditionFixture({
            type: DataConditionType.FIRST_SEEN_EVENT,
            comparison: true,
          }),
        ],
      },
      actionFilters: [ActionFilterFixture({conditions: [condition]})],
    };

    expect(getAlertPreviewRequest({frequency: 30, projectIds: ['1'], state})).toBeNull();

    condition.comparison = 'high';
    expect(
      getAlertPreviewRequest({frequency: 30, projectIds: ['1'], state})
    ).toMatchObject({
      actionFilters: [{conditions: [{type: condition.type, comparison: 'high'}]}],
    });
  });

  it('builds a preview request without transient IDs or actions', () => {
    const request = getAlertPreviewRequest({
      frequency: 30,
      projectIds: ['1', '2'],
      state: {
        triggers: {
          id: 'triggers',
          logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
          conditions: [
            DataConditionFixture({
              id: 'trigger-condition',
              type: DataConditionType.FIRST_SEEN_EVENT,
              comparison: true,
            }),
          ],
        },
        actionFilters: [
          ActionFilterFixture({
            id: 'action-filter',
            conditions: [
              DataConditionFixture({
                id: 'filter-condition',
                type: DataConditionType.ISSUE_PRIORITY_EQUALS,
                comparison: 'high',
              }),
            ],
          }),
        ],
      },
    });

    expect(request).toEqual({
      projectIds: [1, 2],
      config: {frequency: 30},
      triggers: {
        logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
        conditions: [
          {
            type: DataConditionType.FIRST_SEEN_EVENT,
            comparison: true,
          },
        ],
      },
      actionFilters: [
        {
          logicType: DataConditionGroupLogicType.ANY,
          conditions: [
            {
              type: DataConditionType.ISSUE_PRIORITY_EQUALS,
              comparison: 'high',
            },
          ],
        },
      ],
    });
  });
});
