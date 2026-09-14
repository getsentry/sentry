import {useMutation, useQueryClient} from '@tanstack/react-query';

import type {IssueAlertRule, IssueAlertRuleAction} from 'sentry/types/alerts';
import {IssueAlertActionType, IssueAlertConditionType} from 'sentry/types/alerts';
import {ActionTarget, ActionType} from 'sentry/types/workflowEngine/actions';
import type {
  NewAutomationAction,
  NewAutomationDataCondition,
} from 'sentry/types/workflowEngine/automations';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useCreateAutomation} from 'sentry/views/automations/hooks';
import {fetchIssueStreamDetectorIdsForProjects} from 'sentry/views/automations/utils/fetchIssueStreamDetectorIds';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';

const HIGH_PRIORITY_WORKFLOW_NAME = 'Send a notification for high priority issues';

export type CreatedProjectRule = Pick<IssueAlertRule, 'actions' | 'id'>;

interface Variables extends Partial<
  Pick<RequestDataFragment, 'conditions' | 'actions' | 'frequency' | 'name'>
> {
  projectId: string;
  isHighPriority?: boolean;
}

function translateCondition(
  condition: RequestDataFragment['conditions'][number]
): NewAutomationDataCondition {
  return {
    type:
      condition.id === IssueAlertConditionType.EVENT_FREQUENCY
        ? DataConditionType.EVENT_FREQUENCY_COUNT
        : DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
    comparison: {
      interval: condition.interval,
      value: Math.max(Number(condition.value), 0),
    },
    conditionResult: true,
  };
}

function translateAction(action: IssueAlertRuleAction): NewAutomationAction {
  const baseAction = {data: {}, status: 'active' as const};

  switch (action.id) {
    case IssueAlertActionType.NOTIFY_EMAIL:
      return {
        ...baseAction,
        type: ActionType.EMAIL,
        data: {fallthrough_type: action.fallthroughType ?? 'ActiveMembers'},
        config: {
          targetType: ActionTarget.ISSUE_OWNERS,
          targetIdentifier: null,
          targetDisplay: null,
        },
      };
    case IssueAlertActionType.SLACK:
      return {
        ...baseAction,
        type: ActionType.SLACK,
        integrationId: action.workspace,
        config: {
          targetType: ActionTarget.SPECIFIC,
          targetIdentifier: action.channel_id ?? '',
          targetDisplay: action.channel ?? null,
        },
      };
    case IssueAlertActionType.DISCORD:
      return {
        ...baseAction,
        type: ActionType.DISCORD,
        integrationId: action.server,
        config: {
          targetType: ActionTarget.SPECIFIC,
          targetIdentifier: action.channel_id ?? null,
          targetDisplay: null,
        },
      };
    case IssueAlertActionType.MS_TEAMS:
      return {
        ...baseAction,
        type: ActionType.MSTEAMS,
        integrationId: action.team,
        config: {
          targetType: ActionTarget.SPECIFIC,
          targetIdentifier: '',
          targetDisplay: action.channel ?? null,
        },
      };
    default:
      throw new Error(`Unsupported project creation alert action: ${action.id}`);
  }
}

export function useCreateProjectRules() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {mutateAsync: createAutomation} = useCreateAutomation({
    suppressErrorMessage: true,
  });

  return useMutation({
    mutationFn: async ({
      projectId,
      name,
      conditions = [],
      actions = [],
      frequency,
      isHighPriority = false,
    }: Variables): Promise<CreatedProjectRule> => {
      const detectorIds = await fetchIssueStreamDetectorIdsForProjects({
        queryClient,
        organization,
        projectIds: [projectId],
      });

      if (detectorIds.length === 0) {
        throw new Error('Could not find issue stream detector for project');
      }

      const workflow = await createAutomation({
        name: isHighPriority ? HIGH_PRIORITY_WORKFLOW_NAME : name || 'New Alert',
        enabled: true,
        environment: null,
        config: {frequency},
        detectorIds,
        triggers: {
          logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
          conditions: isHighPriority
            ? [
                {
                  type: DataConditionType.NEW_HIGH_PRIORITY_ISSUE,
                  comparison: true,
                  conditionResult: true,
                },
                {
                  type: DataConditionType.EXISTING_HIGH_PRIORITY_ISSUE,
                  comparison: true,
                  conditionResult: true,
                },
              ]
            : [],
        },
        actionFilters: [
          {
            logicType: DataConditionGroupLogicType.ALL,
            conditions: isHighPriority ? [] : conditions.map(translateCondition),
            actions: actions.map(translateAction),
          },
        ],
      });

      return {id: workflow.id, actions};
    },
  });
}
