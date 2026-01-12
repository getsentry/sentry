import {t} from 'sentry/locale';
import type {ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation, StatusWarning} from 'sentry/types/workflowEngine/automations';
import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {AgeComparison} from 'sentry/views/automations/components/actionFilters/constants';
import type {ConflictingConditions} from 'sentry/views/automations/components/automationBuilderConflictContext';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

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

export function getAutomationActionsWarning(
  automation: Automation
): StatusWarning | null {
  const allActions = automation.actionFilters.flatMap(filter => filter.actions ?? []);
  const inactiveCount = allActions.filter(action => action.status === 'disabled').length;
  const totalCount = allActions.length;

  if (totalCount === 0) {
    return {
      color: 'danger' as const,
      message: t('You must add an action for this alert to run.'),
    };
  }
  if (inactiveCount === totalCount) {
    return {
      color: 'danger' as const,
      message: t(
        'Alert is invalid because no actions can run. Actions need to be reconfigured.'
      ),
    };
  }
  if (inactiveCount > 0) {
    return {
      color: 'warning' as const,
      message: t('One or more actions need to be reconfigured in order to run.'),
    };
  }
  return null;
}

export function useAutomationProjectIds(automation: Automation): string[] {
  const {data: detectors} = useDetectorsQuery({ids: automation.detectorIds});
  return [
    ...new Set(detectors?.map(detector => detector.projectId).filter(x => x) ?? []),
  ] as string[];
}

export function findConflictingConditions(
  triggers: DataConditionGroup,
  actionFilters: DataConditionGroup[]
): ConflictingConditions {
  // Check for duplicate trigger conditions
  const duplicateConditions = findDuplicateTriggerConditions(triggers);
  if (duplicateConditions.size > 0) {
    return {
      conflictingConditionGroups: {[triggers.id]: duplicateConditions},
      conflictReason: t('Delete duplicate triggers to continue.'),
    };
  }

  // Check for mutually exclusive trigger conditions with ALL logic
  if (triggers.logicType === DataConditionGroupLogicType.ALL) {
    const conflictingTriggerConditions =
      findFirstSeenEventConflictingConditions(triggers);
    if (conflictingTriggerConditions.size > 1) {
      return {
        conflictingConditionGroups: {
          [triggers.id]: conflictingTriggerConditions,
        },
        conflictReason: t(
          'The triggers highlighted in red are mutually exclusive and cannot be used together with "All" logic.'
        ),
      };
    }
  }

  let hasConflictingActionFilters = false;

  // Check for first seen event condition
  const firstSeenId = triggers.conditions.find(
    condition => condition.type === DataConditionType.FIRST_SEEN_EVENT
  )?.id;

  // First seen event condition does not cause conflicts if the logic type is ANY_SHORT_CIRCUIT and there are multiple trigger conditions
  if (
    firstSeenId &&
    !(
      triggers.logicType === DataConditionGroupLogicType.ANY_SHORT_CIRCUIT &&
      triggers.conditions.length > 1
    )
  ) {
    const conflictingConditions: Record<string, Set<string>> = {};

    // Create a mapping of conflicting conditions for each action filter
    for (const actionFilter of actionFilters) {
      const conflicts = findFirstSeenEventConflictingConditions(actionFilter);
      conflictingConditions[actionFilter.id] = conflicts;
      if (conflicts.size > 0) {
        hasConflictingActionFilters = true;
      }
    }
    // First seen event is only conflicting if there are conflicting action filter conditions
    if (hasConflictingActionFilters) {
      return {
        conflictingConditionGroups: {
          [triggers.id]: new Set<string>([firstSeenId]),
          ...conflictingConditions,
        },
        conflictReason: t(
          'The conditions highlighted in red are in conflict with "A new issue is created."'
        ),
      };
    }
  }

  // Check for conflicting issue priority conditions in action filters
  const conflictingActionFilters: Record<string, Set<string>> = {};
  for (const actionFilter of actionFilters) {
    const conflictingConditions = findConflictingPriorityConditions(actionFilter);
    if (conflictingConditions.size > 0) {
      hasConflictingActionFilters = true;
      conflictingActionFilters[actionFilter.id] = conflictingConditions;
    }
  }

  if (hasConflictingActionFilters) {
    return {
      conflictingConditionGroups: conflictingActionFilters,
      conflictReason: t(
        'The issue priority conditions highlighted in red are in conflict.'
      ),
    };
  }

  return {
    conflictingConditionGroups: {},
    conflictReason: null,
  };
}

const conflictingTriggers = new Set<DataConditionType>([
  DataConditionType.FIRST_SEEN_EVENT,
  DataConditionType.ISSUE_RESOLVED_TRIGGER,
  DataConditionType.REGRESSION_EVENT,
  DataConditionType.REAPPEARED_EVENT,
]);

const frequencyTypes = new Set<DataConditionType>([
  DataConditionType.EVENT_FREQUENCY_COUNT,
  DataConditionType.EVENT_FREQUENCY_PERCENT,
  DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
  DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
]);

function findFirstSeenEventConflictingConditions(
  conditionGroup: DataConditionGroup
): Set<string> {
  const conflictingConditions: Set<string> = new Set<string>();

  // Find incompatible conditions for NONE logic type
  if (conditionGroup.logicType === DataConditionGroupLogicType.NONE) {
    for (const condition of conditionGroup.conditions) {
      const isInvalidAgeComparison =
        condition.type === DataConditionType.AGE_COMPARISON &&
        condition.comparison.comparison_type === AgeComparison.NEWER &&
        condition.comparison.value > 0;
      const isInvalidIssueOccurence =
        condition.type === DataConditionType.ISSUE_OCCURRENCES &&
        condition.comparison.value <= 1;

      if (isInvalidAgeComparison || isInvalidIssueOccurence) {
        conflictingConditions.add(condition.id);
      }
    }
    return conflictingConditions;
  }

  // Find incompatible conditions for ANY_SHORT_CIRCUIT and ALL logic types
  for (const condition of conditionGroup.conditions) {
    const isConflictingTrigger = conflictingTriggers.has(condition.type);
    const isInvalidFrequency =
      frequencyTypes.has(condition.type) && condition.comparison.value >= 1;
    const isInvalidAgeComparison =
      condition.type === DataConditionType.AGE_COMPARISON &&
      condition.comparison.comparison_type === AgeComparison.OLDER;
    const isInvalidIssueOccurence =
      condition.type === DataConditionType.ISSUE_OCCURRENCES &&
      condition.comparison.value > 1;

    if (
      isConflictingTrigger ||
      isInvalidFrequency ||
      isInvalidAgeComparison ||
      isInvalidIssueOccurence
    ) {
      conflictingConditions.add(condition.id);
    }
  }

  // If the logic type is ANY_SHORT_CIRCUIT and any of the conditions are valid, consider the action filter valid
  if (
    conditionGroup.logicType === DataConditionGroupLogicType.ANY_SHORT_CIRCUIT &&
    conflictingConditions.size !== conditionGroup.conditions.length
  ) {
    return new Set<string>();
  }

  return conflictingConditions;
}

function findConflictingPriorityConditions(
  conditionGroup: DataConditionGroup
): Set<string> {
  const conflictingConditions: Set<string> = new Set<string>();

  const priorityGreaterOrEqualConditions: string[] = [];
  const priorityDeescalatingConditions: string[] = [];

  // Conflicting issue priority conditions are only relevant for ALL logic type
  if (conditionGroup.logicType !== DataConditionGroupLogicType.ALL) {
    return conflictingConditions;
  }

  for (const condition of conditionGroup.conditions) {
    const isIssuePriority =
      condition.type === DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL;
    const isIssuePriorityDeescalating =
      condition.type === DataConditionType.ISSUE_PRIORITY_DEESCALATING;
    if (isIssuePriority) {
      priorityGreaterOrEqualConditions.push(condition.id);
    }
    if (isIssuePriorityDeescalating) {
      priorityDeescalatingConditions.push(condition.id);
    }
  }

  // Issue priority and priority deescalating conditions conflict if logic type is ALL
  if (
    conditionGroup.logicType === DataConditionGroupLogicType.ALL &&
    priorityGreaterOrEqualConditions.length > 0 &&
    priorityDeescalatingConditions.length > 0
  ) {
    priorityGreaterOrEqualConditions.forEach(id => conflictingConditions.add(id));
    priorityDeescalatingConditions.forEach(id => conflictingConditions.add(id));
  }

  return conflictingConditions;
}

function findDuplicateTriggerConditions(triggers: DataConditionGroup): Set<string> {
  const conditionCounts: Record<string, string[]> = {};
  const duplicates: Set<string> = new Set();

  // Count the number of conditions for each type
  for (const condition of triggers.conditions) {
    if (conflictingTriggers.has(condition.type)) {
      if (!conditionCounts[condition.type]) {
        conditionCounts[condition.type] = [];
      }
      conditionCounts[condition.type]?.push(condition.id);
    }
  }

  // Find all duplicates
  Object.entries(conditionCounts).forEach(([, conditionIds]) => {
    if (conditionIds.length > 1) {
      conditionIds.forEach(id => duplicates.add(id));
    }
  });
  return duplicates;
}
