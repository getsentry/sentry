import type {ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {
  ConflictingConditions,
  DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {AgeComparison} from 'sentry/views/automations/components/actionFilters/constants';
import {useDetectorQueriesByIds} from 'sentry/views/detectors/hooks';

export function getAutomationActions(automation: Automation): ActionType[] {
  return [
    ...new Set(
      automation.actionFilters
        .flatMap(dataConditionGroup =>
          dataConditionGroup.actions?.map(action => action.type)
        )
        .filter(x => x)
    ),
  ] as ActionType[];
}

export function useAutomationProjectIds(automation: Automation): string[] {
  const queries = useDetectorQueriesByIds(automation.detectorIds);
  return [
    ...new Set(queries.map(query => query.data?.projectId).filter(x => x)),
  ] as string[];
}

export function findConflictingConditions(
  triggers: DataConditionGroup,
  actionFilters: DataConditionGroup[]
): ConflictingConditions {
  // First check for conflicting trigger conditions
  if (
    triggers.logicType === DataConditionGroupLogicType.ALL &&
    triggers.conditions.length > 1
  ) {
    return {
      conflictingTriggers: triggers.conditions.map(condition => condition.id),
      conflictingActionFilters: {},
    };
  }

  // Check for first seen event condition
  const firstSeenId = triggers.conditions.find(
    condition => condition.type === DataConditionType.FIRST_SEEN_EVENT
  )?.id;
  const conflictingConditions: Record<string, string[]> = {};
  let hasConflictingActionFilters = false;

  // First seen event condition does not cause conflicts if the logic type is ANY_SHORT_CIRCUIT and there are multiple trigger conditions
  if (
    firstSeenId &&
    !(
      triggers.logicType === DataConditionGroupLogicType.ANY_SHORT_CIRCUIT &&
      triggers.conditions.length > 1
    )
  ) {
    // Create a mapping of conflicting conditions for each action filter
    for (const actionFilter of actionFilters) {
      const conflicts = findConflictingActionFilterConditions(actionFilter);
      conflictingConditions[actionFilter.id] = conflicts;
      if (conflicts.length > 0) {
        hasConflictingActionFilters = true;
      }
    }
    // First seen event is only conflicting if there are conflicting action filter conditions
    if (hasConflictingActionFilters) {
      return {
        conflictingTriggers: [firstSeenId],
        conflictingActionFilters: conflictingConditions,
      };
    }
  }
  return {
    conflictingTriggers: [],
    conflictingActionFilters: {},
  };
}

const frequencyTypes = [
  DataConditionType.EVENT_FREQUENCY_COUNT,
  DataConditionType.EVENT_FREQUENCY_PERCENT,
  DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
  DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
];

function findConflictingActionFilterConditions(
  actionFilter: DataConditionGroup
): string[] {
  const conflictingConditions: string[] = [];

  // Find incompatible conditions for NONE logic type
  if (actionFilter.logicType === DataConditionGroupLogicType.NONE) {
    for (const condition of actionFilter.conditions) {
      const isInvalidAgeComparison =
        condition.type === DataConditionType.AGE_COMPARISON &&
        condition.comparison.comparison_type === AgeComparison.NEWER &&
        condition.comparison.value > 0;
      const isInvalidIssueOccurence =
        condition.type === DataConditionType.ISSUE_OCCURRENCES &&
        condition.comparison.value <= 1;

      if (isInvalidAgeComparison || isInvalidIssueOccurence) {
        conflictingConditions.push(condition.id);
      }
      return conflictingConditions;
    }
  }

  // Find incompatible conditions for ANY_SHORT_CIRCUIT and ALL logic types
  for (const condition of actionFilter.conditions) {
    const isInvalidFrequency =
      frequencyTypes.includes(condition.type) && condition.comparison.value >= 1;
    const isInvalidAgeComparison =
      condition.type === DataConditionType.AGE_COMPARISON &&
      condition.comparison.comparison_type === AgeComparison.OLDER;
    const isInvalidIssueOccurence =
      condition.type === DataConditionType.ISSUE_OCCURRENCES &&
      condition.comparison.value > 1;

    if (isInvalidFrequency || isInvalidAgeComparison || isInvalidIssueOccurence) {
      conflictingConditions.push(condition.id);
    }
  }

  // If the logic type is ANY_SHORT_CIRCUIT and any of the conditions are valid, consider the action filter valid
  if (
    actionFilter.logicType === DataConditionGroupLogicType.ANY_SHORT_CIRCUIT &&
    conflictingConditions.length !== actionFilter.conditions.length
  ) {
    return [];
  }

  return conflictingConditions;
}
