import {ActionFilterFixture, ActionFixture} from 'sentry-fixture/automations';

import {ActionTarget, ActionType} from 'sentry/types/workflowEngine/actions';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';

import {
  getActionDescription,
  getAutomationName,
  MAX_ACTIONS_IN_NAME,
  MAX_NAME_LENGTH,
} from './automationNameUtils';

describe('automationNameUtils', () => {
  describe('getActionDescription', () => {
    it('should return correct description for EMAIL action with ISSUE_OWNERS target', () => {
      const action = ActionFixture({
        type: ActionType.EMAIL,
        config: {
          targetType: ActionTarget.ISSUE_OWNERS,
        },
      });

      expect(getActionDescription(action)).toBe('Notify Suggested Assignees');
    });

    it('should return correct description for EMAIL action with TEAM target', () => {
      const action = ActionFixture({
        type: ActionType.EMAIL,
        config: {
          targetType: ActionTarget.TEAM,
          targetDisplay: 'backend',
        },
      });

      expect(getActionDescription(action)).toBe('Notify team #backend');
    });

    it('should return correct description for EMAIL action with user target', () => {
      const action = ActionFixture({
        type: ActionType.EMAIL,
        config: {
          targetType: ActionTarget.USER,
          targetDisplay: 'john@example.com',
        },
      });

      expect(getActionDescription(action)).toBe('Notify john@example.com');
    });

    it('should return correct description for SENTRY_APP action', () => {
      const action = ActionFixture({
        type: ActionType.SENTRY_APP,
        config: {
          targetType: ActionTarget.SENTRY_APP,
          targetDisplay: 'My App',
        },
      });

      expect(getActionDescription(action)).toBe('Notify via My App');
    });

    it('should return correct description for WEBHOOK action', () => {
      const action = ActionFixture({
        type: ActionType.WEBHOOK,
        config: {
          targetType: null,
          targetDisplay: 'Custom Webhook',
        },
      });

      expect(getActionDescription(action)).toBe('Notify via Custom Webhook');
    });
  });

  describe('getAutomationName', () => {
    const createBuilderState = (actions: any[]): AutomationBuilderState =>
      ({
        actionFilters: [ActionFilterFixture({actions})],
      }) as AutomationBuilderState;

    it('should return "" for empty actions', () => {
      const builderState = createBuilderState([]);
      expect(getAutomationName(builderState)).toBe('');
    });

    it('should return single action description', () => {
      const actions = [
        ActionFixture({
          type: ActionType.EMAIL,
          config: {
            targetType: ActionTarget.TEAM,
            targetDisplay: 'backend',
          },
        }),
      ];
      const builderState = createBuilderState(actions);

      expect(getAutomationName(builderState)).toBe('Notify team #backend');
    });

    it('should join multiple actions with commas', () => {
      const actions = [
        ActionFixture({
          type: ActionType.EMAIL,
          config: {
            targetType: ActionTarget.TEAM,
            targetDisplay: 'backend',
          },
        }),
        ActionFixture({
          type: ActionType.SENTRY_APP,
          config: {
            targetType: ActionTarget.SENTRY_APP,
            targetDisplay: 'Slack',
          },
        }),
      ];
      const builderState = createBuilderState(actions);

      expect(getAutomationName(builderState)).toBe(
        'Notify team #backend, Notify via Slack'
      );
    });

    it('should include count suffix when there are more than MAX_ACTIONS_IN_NAME actions', () => {
      const actions = new Array(5).fill(
        ActionFixture({
          type: ActionType.EMAIL,
          config: {
            targetType: ActionTarget.TEAM,
            targetDisplay: 'team',
          },
        })
      );
      const builderState = createBuilderState(actions);

      expect(getAutomationName(builderState)).toBe(
        'Notify team #team, Notify team #team, Notify team #team (+2)'
      );
    });

    it('should handle character limit by removing actions from the end', () => {
      // Create actions with very long descriptions to exceed the limit
      const longDescription = 'A'.repeat(200);
      const action = ActionFixture({
        type: ActionType.EMAIL,
        config: {
          targetType: ActionTarget.USER,
          targetDisplay: longDescription,
        },
      });
      const actions = new Array(5).fill(action);
      const builderState = createBuilderState(actions);

      const result = getAutomationName(builderState);
      expect(result.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
      expect(result).toBe(getActionDescription(action) + ' (+4)');
    });

    it('should fallback to "New Alert (X actions)" when even single action is too long', () => {
      const veryLongDescription = 'A'.repeat(MAX_NAME_LENGTH);
      const actions = [
        ActionFixture({
          type: ActionType.EMAIL,
          config: {
            targetType: ActionTarget.USER,
            targetDisplay: veryLongDescription,
          },
        }),
        ActionFixture({
          type: ActionType.EMAIL,
          config: {
            targetType: ActionTarget.USER,
            targetDisplay: veryLongDescription,
          },
        }),
      ];
      const builderState = createBuilderState(actions);

      const result = getAutomationName(builderState);
      expect(result).toBe('New Alert (2 actions)');
      expect(result.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
    });

    it('should respect MAX_ACTIONS_IN_NAME limit', () => {
      const actions = new Array(10).fill(null).map(() =>
        ActionFixture({
          type: ActionType.EMAIL,
          config: {
            targetType: ActionTarget.TEAM,
            targetDisplay: 'team',
          },
        })
      );
      const builderState = createBuilderState(actions);

      const result = getAutomationName(builderState);
      // Should only include up to MAX_ACTIONS_IN_NAME actions in the description
      const actionCount = (result.match(/Notify/g) || []).length;
      expect(actionCount).toBe(MAX_ACTIONS_IN_NAME);
      expect(result).toContain('(+7)'); // 10 - 3 = 7 remaining
    });

    it('should handle actions from multiple action filters', () => {
      const builderState = {
        actionFilters: [
          ActionFilterFixture({
            actions: [
              ActionFixture({
                type: ActionType.EMAIL,
                config: {
                  targetType: ActionTarget.TEAM,
                  targetDisplay: 'backend',
                },
              }),
            ],
          }),
          ActionFilterFixture({
            actions: [
              ActionFixture({
                type: ActionType.SENTRY_APP,
                config: {
                  targetType: ActionTarget.SENTRY_APP,
                  targetDisplay: 'Slack',
                },
              }),
            ],
          }),
        ],
      } as AutomationBuilderState;

      expect(getAutomationName(builderState)).toBe(
        'Notify team #backend, Notify via Slack'
      );
    });
  });
});
