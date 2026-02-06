import type {
  AndOp,
  NotOp,
  OrOp,
  StatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

import {isAfterOp, moveTo} from './utils';

describe('moveTo', () => {
  it('moves op to after another op in the same parent', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
        {
          id: 'status-3',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 202,
        },
      ],
    };

    const result = moveTo(rootOp, 'status-1', 'status-3', 'after');

    expect(result.children.map(c => c.id)).toEqual(['status-2', 'status-3', 'status-1']);
  });

  it('moves op to before another op in the same parent', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
        {
          id: 'status-3',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 202,
        },
      ],
    };

    const result = moveTo(rootOp, 'status-3', 'status-1', 'before');

    expect(result.children.map(c => c.id)).toEqual(['status-3', 'status-1', 'status-2']);
  });

  it('moves op to before the first element', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
        {
          id: 'status-3',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 202,
        },
      ],
    };

    const result = moveTo(rootOp, 'status-3', 'status-1', 'before');

    expect(result.children.map(c => c.id)).toEqual(['status-3', 'status-1', 'status-2']);
  });

  it('moves op to after the last element', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
        {
          id: 'status-3',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 202,
        },
      ],
    };

    const result = moveTo(rootOp, 'status-1', 'status-3', 'after');

    expect(result.children.map(c => c.id)).toEqual(['status-2', 'status-3', 'status-1']);
  });

  it('moves op from nested group to root level', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'or-1',
          op: 'or',
          children: [
            {
              id: 'status-2',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 201,
            },
            {
              id: 'status-3',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 202,
            },
          ],
        },
      ],
    };

    const result = moveTo(rootOp, 'status-2', 'status-1', 'after');

    expect(result.children.map(c => c.id)).toEqual(['status-1', 'status-2', 'or-1']);
    // Verify the nested group still has status-3
    const orOp = result.children.find(c => c.id === 'or-1') as OrOp;
    expect(orOp.children.map(c => c.id)).toEqual(['status-3']);
  });

  it('moves op from root to nested group', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'or-1',
          op: 'or',
          children: [
            {
              id: 'status-2',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 201,
            },
            {
              id: 'status-3',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 202,
            },
          ],
        },
      ],
    };

    const result = moveTo(rootOp, 'status-1', 'status-2', 'before');

    expect(result.children.map(c => c.id)).toEqual(['or-1']);
    // Verify status-1 is now in the nested group
    const orOp = result.children.find(c => c.id === 'or-1') as OrOp;
    expect(orOp.children.map(c => c.id)).toEqual(['status-1', 'status-2', 'status-3']);
  });

  it('moves op within a nested group', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'or-1',
          op: 'or',
          children: [
            {
              id: 'status-2',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 201,
            },
            {
              id: 'status-3',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 202,
            },
            {
              id: 'status-4',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 203,
            },
          ],
        },
      ],
    };

    const result = moveTo(rootOp, 'status-4', 'status-2', 'before');

    const orOp = result.children.find(c => c.id === 'or-1') as OrOp;
    expect(orOp.children.map(c => c.id)).toEqual(['status-4', 'status-2', 'status-3']);
  });

  it('returns unchanged tree if source not found', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
      ],
    };

    const result = moveTo(rootOp, 'nonexistent', 'status-1', 'after');

    expect(result).toBe(rootOp);
  });

  it('returns unchanged tree if target not found', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
      ],
    };

    const result = moveTo(rootOp, 'status-1', 'nonexistent', 'after');

    expect(result).toBe(rootOp);
  });

  it('preserves op data when moving', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'less_than'},
          value: 400,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
      ],
    };

    const result = moveTo(rootOp, 'status-1', 'status-2', 'after');

    const movedOp = result.children.find(c => c.id === 'status-1') as StatusCodeOp;
    expect(movedOp.operator).toEqual({cmp: 'less_than'});
    expect(movedOp.value).toBe(400);
  });

  it('handles two ops: move last before first, then back after first', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
      ],
    };

    // Move status-2 before status-1
    const afterFirstMove = moveTo(rootOp, 'status-2', 'status-1', 'before');
    expect(afterFirstMove.children.map(c => c.id)).toEqual(['status-2', 'status-1']);

    // Move status-2 back after status-1 (should return to original order)
    const afterSecondMove = moveTo(afterFirstMove, 'status-2', 'status-1', 'after');
    expect(afterSecondMove.children.map(c => c.id)).toEqual(['status-1', 'status-2']);
  });

  it('handles multiple consecutive moves', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
        {
          id: 'status-3',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 202,
        },
      ],
    };

    // Move 3 before 1
    let result = moveTo(rootOp, 'status-3', 'status-1', 'before');
    expect(result.children.map(c => c.id)).toEqual(['status-3', 'status-1', 'status-2']);

    // Move 3 after 1
    result = moveTo(result, 'status-3', 'status-1', 'after');
    expect(result.children.map(c => c.id)).toEqual(['status-1', 'status-3', 'status-2']);

    // Move 3 after 2
    result = moveTo(result, 'status-3', 'status-2', 'after');
    expect(result.children.map(c => c.id)).toEqual(['status-1', 'status-2', 'status-3']);
  });

  it('does not create duplicate ops when moving rapidly', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
      ],
    };

    // Simulate rapid drag events
    let result = moveTo(rootOp, 'status-2', 'status-1', 'before');
    result = moveTo(result, 'status-2', 'status-1', 'before');
    result = moveTo(result, 'status-2', 'status-1', 'after');

    // Should have exactly 2 children, no duplicates
    expect(result.children).toHaveLength(2);
    expect(result.children.map(c => c.id)).toEqual(['status-1', 'status-2']);
  });

  it('handles moving an op to where it already is (no-op move)', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
      ],
    };

    // Try to move status-1 before status-2 (it's already before status-2)
    const result = moveTo(rootOp, 'status-1', 'status-2', 'before');
    expect(result.children.map(c => c.id)).toEqual(['status-1', 'status-2']);
    expect(result.children).toHaveLength(2);
  });

  it('verifies no duplicate IDs after complex moves', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
      ],
    };

    // Move back and forth multiple times
    let result = moveTo(rootOp, 'status-2', 'status-1', 'before');
    result = moveTo(result, 'status-2', 'status-1', 'after');
    result = moveTo(result, 'status-1', 'status-2', 'before');

    // Collect all IDs and check for duplicates
    const ids = result.children.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(ids).toHaveLength(uniqueIds.size);
    expect(result.children).toHaveLength(2);
  });

  it('handles moving to same position (status-1 after status-1 should do nothing)', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
      ],
    };

    // Try to move status-2 after status-1 (it's already after status-1)
    const result = moveTo(rootOp, 'status-2', 'status-1', 'after');
    expect(result.children.map(c => c.id)).toEqual(['status-1', 'status-2']);
    expect(result.children).toHaveLength(2);
  });

  it('moves op inside an empty group', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'or-1',
          op: 'or',
          children: [],
        },
      ],
    };

    const result = moveTo(rootOp, 'status-1', 'or-1', 'inside');

    // Root should only have the or group now
    expect(result.children.map(c => c.id)).toEqual(['or-1']);
    // The or group should now contain status-1
    const orOp = result.children.find(c => c.id === 'or-1') as OrOp;
    expect(orOp.children.map(c => c.id)).toEqual(['status-1']);
  });

  it('moves op inside an empty not group', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'not-1',
          op: 'not',
          operand: {
            id: 'or-1',
            op: 'or',
            children: [],
          },
        },
      ],
    };

    const result = moveTo(rootOp, 'status-1', 'or-1', 'inside');

    // Root should only have the not group now
    expect(result.children.map(c => c.id)).toEqual(['not-1']);
    // The not's operand (or group) should now contain status-1
    const notOp = result.children.find(c => c.id === 'not-1') as NotOp;
    const orOp = notOp.operand as OrOp;
    expect(orOp.children.map(c => c.id)).toEqual(['status-1']);
  });

  it('moves op inside a non-empty group (appends to end)', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'or-1',
          op: 'or',
          children: [
            {
              id: 'status-2',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 201,
            },
          ],
        },
      ],
    };

    const result = moveTo(rootOp, 'status-1', 'or-1', 'inside');

    // Root should only have the or group now
    expect(result.children.map(c => c.id)).toEqual(['or-1']);
    // The or group should now contain both ops
    const orOp = result.children.find(c => c.id === 'or-1') as OrOp;
    expect(orOp.children.map(c => c.id)).toEqual(['status-2', 'status-1']);
  });

  it('returns unchanged tree if target for inside move is not a group', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
      ],
    };

    // Try to move inside a non-group op (should do nothing)
    const result = moveTo(rootOp, 'status-1', 'status-2', 'inside');

    expect(result).toBe(rootOp);
  });

  it('returns unchanged tree when moving parent into its own descendant', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'or-1',
          op: 'or',
          children: [
            {
              id: 'status-1',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 200,
            },
            {
              id: 'and-2',
              op: 'and',
              children: [
                {
                  id: 'status-2',
                  op: 'status_code_check',
                  operator: {cmp: 'equals'},
                  value: 201,
                },
              ],
            },
          ],
        },
      ],
    };

    // Try to move or-1 inside its descendant and-2 (should do nothing)
    const result = moveTo(rootOp, 'or-1', 'and-2', 'inside');
    expect(result).toBe(rootOp);

    // Also test before/after positions
    const resultBefore = moveTo(rootOp, 'or-1', 'status-2', 'before');
    expect(resultBefore).toBe(rootOp);

    const resultAfter = moveTo(rootOp, 'or-1', 'status-2', 'after');
    expect(resultAfter).toBe(rootOp);
  });

  it('moves op from nested group inside another group', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'or-1',
          op: 'or',
          children: [
            {
              id: 'status-1',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 200,
            },
            {
              id: 'status-2',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 201,
            },
          ],
        },
        {
          id: 'or-2',
          op: 'or',
          children: [],
        },
      ],
    };

    const result = moveTo(rootOp, 'status-1', 'or-2', 'inside');

    // or-1 should now have only status-2
    const or1 = result.children.find(c => c.id === 'or-1') as OrOp;
    expect(or1.children.map(c => c.id)).toEqual(['status-2']);

    // or-2 should now contain status-1
    const or2 = result.children.find(c => c.id === 'or-2') as OrOp;
    expect(or2.children.map(c => c.id)).toEqual(['status-1']);
  });
});

describe('isAfterOp', () => {
  it('returns true when op is directly after another op', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
      ],
    };

    expect(isAfterOp(rootOp, 'status-2', 'status-1')).toBe(true);
  });

  it('returns false when op is not directly after another op', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
        {
          id: 'status-3',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 202,
        },
      ],
    };

    // status-3 is after status-2, not status-1
    expect(isAfterOp(rootOp, 'status-3', 'status-1')).toBe(false);
  });

  it('returns false when op is before another op', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
        {
          id: 'status-2',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 201,
        },
      ],
    };

    expect(isAfterOp(rootOp, 'status-1', 'status-2')).toBe(false);
  });

  it('returns true when op is after another op in nested group', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'or-1',
          op: 'or',
          children: [
            {
              id: 'status-1',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 200,
            },
            {
              id: 'status-2',
              op: 'status_code_check',
              operator: {cmp: 'equals'},
              value: 201,
            },
          ],
        },
      ],
    };

    expect(isAfterOp(rootOp, 'status-2', 'status-1')).toBe(true);
  });

  it('returns true when op is after another op inside not group', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'not-1',
          op: 'not',
          operand: {
            id: 'or-1',
            op: 'or',
            children: [
              {
                id: 'status-1',
                op: 'status_code_check',
                operator: {cmp: 'equals'},
                value: 200,
              },
              {
                id: 'status-2',
                op: 'status_code_check',
                operator: {cmp: 'equals'},
                value: 201,
              },
            ],
          },
        },
      ],
    };

    expect(isAfterOp(rootOp, 'status-2', 'status-1')).toBe(true);
  });

  it('returns false for non-existent ops', () => {
    const rootOp: AndOp = {
      id: 'and-1',
      op: 'and',
      children: [
        {
          id: 'status-1',
          op: 'status_code_check',
          operator: {cmp: 'equals'},
          value: 200,
        },
      ],
    };

    expect(isAfterOp(rootOp, 'nonexistent', 'status-1')).toBe(false);
    expect(isAfterOp(rootOp, 'status-1', 'nonexistent')).toBe(false);
  });

  it('returns false for leaf ops (non-group containers)', () => {
    const statusOp: StatusCodeOp = {
      id: 'status-1',
      op: 'status_code_check',
      operator: {cmp: 'equals'},
      value: 200,
    };

    expect(isAfterOp(statusOp, 'any', 'other')).toBe(false);
  });
});
