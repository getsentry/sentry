import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {AgeComparison} from 'sentry/views/automations/components/actionFilters/constants';
import {findConflictingConditions} from 'sentry/views/automations/hooks/utils';

describe('findConflictingConditions', () => {
  it('returns nothing when there is a valid trigger and logic type is ANY_SHORT_CIRCUIT', () => {
    const triggers: DataConditionGroup = {
      id: 'triggers',
      logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
      conditions: [
        {
          id: '1',
          type: DataConditionType.FIRST_SEEN_EVENT,
          comparison: {comparison_type: 'equals', value: 5},
        },
        {
          id: '2',
          type: DataConditionType.REAPPEARED_EVENT,
          comparison: {comparison_type: 'equals', value: 5},
        },
      ],
    };
    const actionFilters = [
      {
        id: 'actionFilter1',
        logicType: DataConditionGroupLogicType.ALL,
        conditions: [
          {
            id: '3',
            type: DataConditionType.ISSUE_OCCURRENCES,
            comparison: {value: 5},
          },
        ],
      },
    ];

    const result = findConflictingConditions(triggers, actionFilters);
    expect(result).toEqual({
      conflictingTriggers: [],
      conflictingActionFilters: {},
    });
  });

  it('returns conflict when only trigger condition is FIRST_SEEN_EVENT', () => {
    const triggers: DataConditionGroup = {
      id: 'triggers',
      logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
      conditions: [
        {
          id: '1',
          type: DataConditionType.FIRST_SEEN_EVENT,
          comparison: {comparison_type: 'equals', value: 5},
        },
      ],
    };
    const actionFilters = [
      {
        id: 'actionFilter1',
        logicType: DataConditionGroupLogicType.ALL,
        conditions: [
          {
            id: '2',
            type: DataConditionType.ISSUE_OCCURRENCES,
            comparison: {value: 5},
          },
        ],
      },
    ];

    const anyShortCircuitResult = findConflictingConditions(triggers, actionFilters);
    expect(anyShortCircuitResult).toEqual({
      conflictingTriggers: ['1'],
      conflictingActionFilters: {actionFilter1: ['2']},
    });

    const allResult = findConflictingConditions(
      {...triggers, logicType: DataConditionGroupLogicType.ALL},
      actionFilters
    );
    expect(allResult).toEqual({
      conflictingTriggers: ['1'],
      conflictingActionFilters: {actionFilter1: ['2']},
    });
  });

  it('returns conflicting trigger conditions', () => {
    const triggers: DataConditionGroup = {
      id: 'triggers',
      logicType: DataConditionGroupLogicType.ALL,
      conditions: [
        {
          id: '1',
          type: DataConditionType.FIRST_SEEN_EVENT,
          comparison: {comparison_type: 'equals', value: 5},
        },
        {
          id: '2',
          type: DataConditionType.REAPPEARED_EVENT,
          comparison: {comparison_type: 'equals', value: 5},
        },
      ],
    };
    const actionFilters = [
      // When trigger conditions conflict, we skip validating the action filters
      {
        id: 'actionFilter1',
        logicType: DataConditionGroupLogicType.ALL,
        conditions: [
          {
            id: '3',
            type: DataConditionType.ISSUE_OCCURRENCES,
            comparison: {value: 5},
          },
        ],
      },
    ];

    const result = findConflictingConditions(triggers, actionFilters);
    expect(result).toEqual({
      conflictingTriggers: ['1', '2'],
      conflictingActionFilters: {},
    });
  });

  it('correctly handles actionFilters where all conditions are invalid', () => {
    const triggers: DataConditionGroup = {
      id: 'triggers',
      logicType: DataConditionGroupLogicType.ALL,
      conditions: [
        {
          id: '1',
          type: DataConditionType.FIRST_SEEN_EVENT,
          comparison: {comparison_type: 'equals', value: 5},
        },
      ],
    };
    const actionFiltersConditions = [
      {
        id: '2',
        type: DataConditionType.EVENT_FREQUENCY_COUNT,
        comparison: {value: 10},
      },
      {
        id: '3',
        type: DataConditionType.EVENT_FREQUENCY_PERCENT,
        comparison: {value: 10},
      },
      {
        id: '4',
        type: DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
        comparison: {value: 10},
      },
      {
        id: '5',
        type: DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
        comparison: {value: 10},
      },
      {
        id: '6',
        type: DataConditionType.ISSUE_OCCURRENCES,
        comparison: {value: 5},
      },
      {
        id: '7',
        type: DataConditionType.AGE_COMPARISON,
        comparison: {comparison_type: AgeComparison.OLDER, value: 10},
      },
    ];

    const anyShortCircuitActionFilters = [
      {
        id: 'actionFilter1',
        logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
        conditions: actionFiltersConditions,
      },
    ];
    const anyShortCircuitResult = findConflictingConditions(
      triggers,
      anyShortCircuitActionFilters
    );
    expect(anyShortCircuitResult).toEqual({
      conflictingTriggers: ['1'],
      conflictingActionFilters: {actionFilter1: ['2', '3', '4', '5', '6', '7']},
    });

    const allActionFilters = [
      {
        id: 'actionFilter1',
        logicType: DataConditionGroupLogicType.ALL,
        conditions: actionFiltersConditions,
      },
    ];
    const allResult = findConflictingConditions(triggers, allActionFilters);
    expect(allResult).toEqual({
      conflictingTriggers: ['1'],
      conflictingActionFilters: {actionFilter1: ['2', '3', '4', '5', '6', '7']},
    });
  });

  it('correctly handles actionFilters where some conditions are invalid', () => {
    const triggers: DataConditionGroup = {
      id: 'triggers',
      logicType: DataConditionGroupLogicType.ALL,
      conditions: [
        {
          id: '1',
          type: DataConditionType.FIRST_SEEN_EVENT,
          comparison: {comparison_type: 'equals', value: 5},
        },
      ],
    };

    const actionFilterConditions = [
      {
        id: '2',
        type: DataConditionType.ISSUE_OCCURRENCES,
        comparison: {value: 5},
      },
      {
        id: '3',
        type: DataConditionType.LATEST_RELEASE,
        comparison: true,
      },
    ];

    // Test with ANY_SHORT_CIRCUIT logic type
    // Since there is a valid condition, the action filter should not be considered conflicting
    const anyShortCircuitActionFilters = [
      {
        id: 'actionFilter1',
        logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
        conditions: actionFilterConditions,
      },
    ];
    const result = findConflictingConditions(triggers, anyShortCircuitActionFilters);
    expect(result).toEqual({
      conflictingTriggers: [],
      conflictingActionFilters: {},
    });

    // Test with ALL logic type
    // Since all conditions must be valid, it should return the conflicting condition
    const allActionFilters = [
      {
        id: 'actionFilter1',
        logicType: DataConditionGroupLogicType.ALL,
        conditions: actionFilterConditions,
      },
    ];
    const resultWithAllLogic = findConflictingConditions(triggers, allActionFilters);
    expect(resultWithAllLogic).toEqual({
      conflictingTriggers: ['1'],
      conflictingActionFilters: {actionFilter1: ['2']},
    });
  });

  it('correctly handles actionFilters with NONE logic type', () => {
    const triggers: DataConditionGroup = {
      id: 'triggers',
      logicType: DataConditionGroupLogicType.ALL,
      conditions: [
        {
          id: '1',
          type: DataConditionType.FIRST_SEEN_EVENT,
          comparison: {comparison_type: 'equals', value: 5},
        },
      ],
    };

    const actionFilters = [
      {
        id: 'actionFilter1',
        logicType: DataConditionGroupLogicType.NONE,
        conditions: [
          {
            id: '2',
            type: DataConditionType.AGE_COMPARISON,
            comparison: {comparison_type: AgeComparison.NEWER, value: 10},
          },
        ],
      },
      {
        id: 'actionFilter2',
        logicType: DataConditionGroupLogicType.NONE,
        conditions: [
          {
            id: '3',
            type: DataConditionType.ISSUE_OCCURRENCES,
            comparison: {value: 0},
          },
        ],
      },
      // All conditions must be valid for NONE logic type, so this action filter is invalid
      {
        id: 'actionFilter3',
        logicType: DataConditionGroupLogicType.NONE,
        conditions: [
          {
            id: '4',
            type: DataConditionType.ISSUE_OCCURRENCES,
            comparison: {value: 0},
          },
          {
            id: '5',
            type: DataConditionType.LATEST_RELEASE,
            comparison: true,
          },
        ],
      },
    ];

    const result = findConflictingConditions(triggers, actionFilters);
    expect(result).toEqual({
      conflictingTriggers: ['1'],
      conflictingActionFilters: {
        actionFilter1: ['2'],
        actionFilter2: ['3'],
        actionFilter3: ['4'],
      },
    });
  });
});
