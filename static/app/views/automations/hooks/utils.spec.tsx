import {DataConditionFixture} from 'sentry-fixture/automations';

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
      conflictingConditionGroups: {},
      conflictReason: null,
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
      conflictingConditionGroups: {
        triggers: new Set(['1']),
        actionFilter1: new Set(['2']),
      },
      conflictReason:
        'The conditions highlighted in red are in conflict with "A new issue is created."',
    });

    const allResult = findConflictingConditions(
      {...triggers, logicType: DataConditionGroupLogicType.ALL},
      actionFilters
    );
    expect(allResult).toEqual({
      conflictingConditionGroups: {
        triggers: new Set(['1']),
        actionFilter1: new Set(['2']),
      },
      conflictReason:
        'The conditions highlighted in red are in conflict with "A new issue is created."',
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
      conflictingConditionGroups: {
        triggers: new Set(['1', '2']),
      },
      conflictReason:
        'The triggers highlighted in red are mutually exclusive and cannot be used together with "All" logic.',
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
      conflictingConditionGroups: {
        triggers: new Set(['1']),
        actionFilter1: new Set(['2', '3', '4', '5', '6', '7']),
      },
      conflictReason:
        'The conditions highlighted in red are in conflict with "A new issue is created."',
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
      conflictingConditionGroups: {
        triggers: new Set(['1']),
        actionFilter1: new Set(['2', '3', '4', '5', '6', '7']),
      },
      conflictReason:
        'The conditions highlighted in red are in conflict with "A new issue is created."',
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
      conflictingConditionGroups: {},
      conflictReason: null,
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
      conflictingConditionGroups: {
        triggers: new Set(['1']),
        actionFilter1: new Set(['2']),
      },
      conflictReason:
        'The conditions highlighted in red are in conflict with "A new issue is created."',
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
      conflictingConditionGroups: {
        triggers: new Set(['1']),
        actionFilter1: new Set(['2']),
        actionFilter2: new Set(['3']),
        actionFilter3: new Set(['4']),
      },
      conflictReason:
        'The conditions highlighted in red are in conflict with "A new issue is created."',
    });
  });

  it('correctly handles conflicting issue priority and priority de-escalating conditions', () => {
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
            id: '3',
            type: DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL,
            comparison: {value: 'high'},
          },
          {
            id: '4',
            type: DataConditionType.ISSUE_PRIORITY_DEESCALATING,
            comparison: true,
          },
        ],
      },
    ];

    const result = findConflictingConditions(triggers, actionFilters);
    expect(result).toEqual({
      conflictingConditionGroups: {
        actionFilter1: new Set(['3', '4']),
      },
      conflictReason: 'The issue priority conditions highlighted in red are in conflict.',
    });
  });

  it('correctly handles duplicate trigger conditions', () => {
    const triggers: DataConditionGroup = {
      id: 'triggers',
      logicType: DataConditionGroupLogicType.ALL,
      conditions: [
        DataConditionFixture({id: '1', type: DataConditionType.FIRST_SEEN_EVENT}),
        DataConditionFixture({id: '2', type: DataConditionType.FIRST_SEEN_EVENT}),
        DataConditionFixture({id: '3', type: DataConditionType.FIRST_SEEN_EVENT}),
        DataConditionFixture({id: '4', type: DataConditionType.REAPPEARED_EVENT}),
        DataConditionFixture({id: '5', type: DataConditionType.REAPPEARED_EVENT}),
      ],
    };

    const result = findConflictingConditions(triggers, []);
    expect(result).toEqual({
      conflictingConditionGroups: {
        triggers: new Set(['1', '2', '3', '4', '5']),
      },
      conflictReason: 'Delete duplicate triggers to continue.',
    });
  });

  describe('Seer activity trigger incompatibilities', () => {
    const seerTriggers: DataConditionGroup = {
      id: 'triggers',
      logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
      conditions: [
        {
          id: '1',
          type: DataConditionType.SEER_ACTIVITY_TRIGGER,
          comparison: ['rca_completed'],
        },
      ],
    };

    it('flags event attribute filters as incompatible with Seer activity triggers', () => {
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.ALL,
          conditions: [
            {id: '2', type: DataConditionType.EVENT_ATTRIBUTE, comparison: {}},
          ],
        },
      ];

      const result = findConflictingConditions(seerTriggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {
          actionFilter1: new Set(['2']),
        },
        conflictReason:
          'The conditions highlighted in red are not compatible with Seer activity triggers.',
      });
    });

    it('flags tagged event, level, and release filters as incompatible', () => {
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.ALL,
          conditions: [
            {id: '2', type: DataConditionType.TAGGED_EVENT, comparison: {}},
            {id: '3', type: DataConditionType.LEVEL, comparison: {}},
            {id: '4', type: DataConditionType.LATEST_RELEASE, comparison: true},
            {
              id: '5',
              type: DataConditionType.LATEST_ADOPTED_RELEASE,
              comparison: {},
            },
          ],
        },
      ];

      const result = findConflictingConditions(seerTriggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {
          actionFilter1: new Set(['2', '3', '4', '5']),
        },
        conflictReason:
          'The conditions highlighted in red are not compatible with Seer activity triggers.',
      });
    });

    it('flags frequency (slow) conditions as incompatible', () => {
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.ALL,
          conditions: [
            {
              id: '2',
              type: DataConditionType.EVENT_FREQUENCY_COUNT,
              comparison: {value: 10},
            },
            {
              id: '3',
              type: DataConditionType.PERCENT_SESSIONS_COUNT,
              comparison: {value: 5},
            },
          ],
        },
      ];

      const result = findConflictingConditions(seerTriggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {
          actionFilter1: new Set(['2', '3']),
        },
        conflictReason:
          'The conditions highlighted in red are not compatible with Seer activity triggers.',
      });
    });

    it('allows compatible issue attribute filters with Seer activity triggers', () => {
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.ALL,
          conditions: [
            {
              id: '2',
              type: DataConditionType.AGE_COMPARISON,
              comparison: {comparison_type: AgeComparison.OLDER, value: 10},
            },
            {
              id: '3',
              type: DataConditionType.ASSIGNED_TO,
              comparison: {targetType: 'Unassigned'},
            },
          ],
        },
      ];

      const result = findConflictingConditions(seerTriggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {},
        conflictReason: null,
      });
    });

    it('clears conflicts with ANY logic when at least one condition is compatible', () => {
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
          conditions: [
            {id: '2', type: DataConditionType.EVENT_ATTRIBUTE, comparison: {}},
            {
              id: '3',
              type: DataConditionType.AGE_COMPARISON,
              comparison: {comparison_type: AgeComparison.OLDER, value: 10},
            },
          ],
        },
      ];

      const result = findConflictingConditions(seerTriggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {},
        conflictReason: null,
      });
    });

    it('flags conflicts with ANY logic when all conditions are incompatible', () => {
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
          conditions: [
            {id: '2', type: DataConditionType.EVENT_ATTRIBUTE, comparison: {}},
            {id: '3', type: DataConditionType.TAGGED_EVENT, comparison: {}},
          ],
        },
      ];

      const result = findConflictingConditions(seerTriggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {
          actionFilter1: new Set(['2', '3']),
        },
        conflictReason:
          'The conditions highlighted in red are not compatible with Seer activity triggers.',
      });
    });

    it('clears conflicts with legacy ANY logic when at least one condition is compatible', () => {
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.ANY,
          conditions: [
            {id: '2', type: DataConditionType.EVENT_ATTRIBUTE, comparison: {}},
            {
              id: '3',
              type: DataConditionType.AGE_COMPARISON,
              comparison: {comparison_type: AgeComparison.OLDER, value: 10},
            },
          ],
        },
      ];

      const result = findConflictingConditions(seerTriggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {},
        conflictReason: null,
      });
    });

    it('flags conflicts with legacy ANY logic when all conditions are incompatible', () => {
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.ANY,
          conditions: [
            {id: '2', type: DataConditionType.EVENT_ATTRIBUTE, comparison: {}},
            {id: '3', type: DataConditionType.TAGGED_EVENT, comparison: {}},
          ],
        },
      ];

      const result = findConflictingConditions(seerTriggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {
          actionFilter1: new Set(['2', '3']),
        },
        conflictReason:
          'The conditions highlighted in red are not compatible with Seer activity triggers.',
      });
    });

    it('does not flag event-required conditions with NONE logic since they evaluate to false', () => {
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.NONE,
          conditions: [
            {id: '2', type: DataConditionType.EVENT_ATTRIBUTE, comparison: {}},
            {id: '3', type: DataConditionType.TAGGED_EVENT, comparison: {}},
          ],
        },
      ];

      const result = findConflictingConditions(seerTriggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {},
        conflictReason: null,
      });
    });

    it('still flags slow conditions with NONE logic since they are silently skipped', () => {
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.NONE,
          conditions: [
            {
              id: '2',
              type: DataConditionType.EVENT_FREQUENCY_COUNT,
              comparison: {value: 10},
            },
          ],
        },
      ];

      const result = findConflictingConditions(seerTriggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {
          actionFilter1: new Set(['2']),
        },
        conflictReason:
          'The conditions highlighted in red are not compatible with Seer activity triggers.',
      });
    });

    it('does not flag Seer incompatibilities when there is no Seer activity trigger', () => {
      const triggers: DataConditionGroup = {
        id: 'triggers',
        logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
        conditions: [
          {
            id: '1',
            type: DataConditionType.FIRST_SEEN_EVENT,
            comparison: {},
          },
        ],
      };
      const actionFilters = [
        {
          id: 'actionFilter1',
          logicType: DataConditionGroupLogicType.ALL,
          conditions: [
            {id: '2', type: DataConditionType.EVENT_ATTRIBUTE, comparison: {}},
          ],
        },
      ];

      const result = findConflictingConditions(triggers, actionFilters);
      expect(result).toEqual({
        conflictingConditionGroups: {},
        conflictReason: null,
      });
    });
  });
});
