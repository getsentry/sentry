import {
  createInitialGroupMergedState,
  groupMergedReducer,
  isAllUnmergedSelected,
} from './useGroupMerged';

describe('groupMerged state', () => {
  const fingerprints = [
    {
      latestEvent: {id: 'event-1'} as any,
      id: '1',
    },
    {
      latestEvent: {id: 'event-2'} as any,
      id: '2',
      mergedBySeer: true,
    },
    {
      latestEvent: {id: 'event-3'} as any,
      id: '3',
    },
  ];

  function getHydratedState() {
    return createInitialGroupMergedState();
  }

  it('keeps seer merge metadata from the endpoint response', () => {
    expect(fingerprints).toHaveLength(3);
    expect(fingerprints.find(fingerprint => fingerprint.id === '2')?.mergedBySeer).toBe(
      true
    );
  });

  it('does not select busy fingerprints', () => {
    const pending = groupMergedReducer(getHydratedState(), {
      type: 'unmergePending',
      fingerprintIds: ['1'],
    });
    const state = groupMergedReducer(pending, {
      type: 'toggleSelected',
      fingerprintId: '1',
      eventId: 'event-1',
    });

    expect(state.unmergeList).toEqual(new Map());
    expect(state.fingerprintState.get('1')).toEqual({
      busy: true,
      checked: false,
    });
  });

  it('selects and unselects fingerprints', () => {
    const selected = groupMergedReducer(getHydratedState(), {
      type: 'toggleSelected',
      fingerprintId: '2',
      eventId: 'event-2',
    });

    expect(selected.unmergeList).toEqual(new Map([['2', 'event-2']]));
    expect(selected.fingerprintState.get('2')).toEqual({checked: true});

    const unselected = groupMergedReducer(selected, {
      type: 'toggleSelected',
      fingerprintId: '2',
      eventId: 'event-2',
    });

    expect(unselected.unmergeList).toEqual(new Map());
    expect(unselected.fingerprintState.get('2')).toEqual({checked: false});
  });

  it('knows when all available fingerprints are selected', () => {
    const busy = groupMergedReducer(getHydratedState(), {
      type: 'unmergePending',
      fingerprintIds: ['1'],
    });
    const firstSelected = groupMergedReducer(busy, {
      type: 'toggleSelected',
      fingerprintId: '2',
      eventId: 'event-2',
    });
    const allSelected = groupMergedReducer(firstSelected, {
      type: 'toggleSelected',
      fingerprintId: '3',
      eventId: 'event-3',
    });

    expect(isAllUnmergedSelected(firstSelected, fingerprints)).toBe(false);
    expect(isAllUnmergedSelected(allSelected, fingerprints)).toBe(true);
  });

  it('keeps successful unmerged rows busy and clears their selection', () => {
    const selected = groupMergedReducer(getHydratedState(), {
      type: 'toggleSelected',
      fingerprintId: '2',
      eventId: 'event-2',
    });
    const pending = groupMergedReducer(selected, {
      type: 'unmergePending',
      fingerprintIds: ['2'],
    });
    const success = groupMergedReducer(pending, {
      type: 'unmergeSuccess',
      fingerprintIds: ['2'],
    });

    expect(success.unmergeList).toEqual(new Map());
    expect(success.fingerprintState.get('2')).toEqual({
      busy: true,
      checked: false,
    });
  });

  it('restores selection when unmerge fails', () => {
    const selected = groupMergedReducer(getHydratedState(), {
      type: 'toggleSelected',
      fingerprintId: '2',
      eventId: 'event-2',
    });
    const pending = groupMergedReducer(selected, {
      type: 'unmergePending',
      fingerprintIds: ['2'],
    });
    const error = groupMergedReducer(pending, {
      type: 'unmergeError',
      fingerprintIds: ['2'],
    });

    expect(error.unmergeList).toEqual(new Map([['2', 'event-2']]));
    expect(error.fingerprintState.get('2')).toEqual({
      busy: false,
      checked: true,
    });
  });
});
