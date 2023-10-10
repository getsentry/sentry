import * as GroupActionCreators from 'sentry/actionCreators/group';
import GroupingStore from 'sentry/stores/groupingStore';

describe('Grouping Store', function () {
  let trigger;

  beforeAll(function () {
    MockApiClient.asyncDelay = 1;
  });

  afterAll(function () {
    MockApiClient.asyncDelay = undefined;
  });

  beforeEach(function () {
    GroupingStore.init();
    trigger = jest.spyOn(GroupingStore, 'trigger');
    MockApiClient.addMockResponse({
      url: '/issues/groupId/hashes/',
      body: [
        {
          latestEvent: {
            eventID: 'event-1',
          },
          state: 'locked',
          id: '1',
        },
        {
          latestEvent: {
            eventID: 'event-2',
          },
          state: 'unlocked',
          id: '2',
        },
        {
          latestEvent: {
            eventID: 'event-3',
          },
          state: 'unlocked',
          id: '3',
        },
        {
          latestEvent: {
            eventID: 'event-4',
          },
          state: 'unlocked',
          id: '4',
        },
        {
          latestEvent: {
            eventID: 'event-5',
          },
          state: 'locked',
          id: '5',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/issues/groupId/similar/',
      body: [
        [
          {
            id: '274',
          },
          {
            'exception:stacktrace:pairs': 0.375,
            'exception:stacktrace:application-chunks': 0.175,
            'message:message:character-shingles': 0.775,
          },
        ],
        [
          {
            id: '275',
          },
          {'exception:stacktrace:pairs': 1.0},
        ],
        [
          {
            id: '216',
          },
          {
            'exception:stacktrace:application-chunks': 0.000235,
            'exception:stacktrace:pairs': 0.001488,
          },
        ],
        [
          {
            id: '217',
          },
          {
            'exception:message:character-shingles': null,
            'exception:stacktrace:application-chunks': 0.25,
            'exception:stacktrace:pairs': 0.25,
            'message:message:character-shingles': 0.7,
          },
        ],
      ],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('onFetch()', function () {
    beforeEach(() => GroupingStore.init());

    it('initially gets called with correct state values', function () {
      GroupingStore.onFetch([]);

      expect(trigger).toHaveBeenCalled();
      expect(trigger).toHaveBeenCalledWith(
        expect.objectContaining({
          error: false,
          filteredSimilarItems: [],
          loading: true,
          mergeState: new Map(),
          mergedItems: [],
          mergedLinks: '',
          similarItems: [],
          similarLinks: '',
          unmergeState: new Map(),
        })
      );
    });

    it('fetches list of similar items', async function () {
      await GroupingStore.onFetch([
        {dataKey: 'similar', endpoint: '/issues/groupId/similar/'},
      ]);

      expect(trigger).toHaveBeenCalled();
      const calls = trigger.mock.calls;
      const arg = calls[calls.length - 1][0];

      expect(arg.filteredSimilarItems).toHaveLength(1);
      expect(arg.similarItems).toHaveLength(3);
      expect(arg).toMatchObject({
        loading: false,
        error: false,
        mergeState: new Map(),
        mergedItems: [],
        similarItems: [
          {
            isBelowThreshold: false,
            issue: {
              id: '274',
            },
          },
          {
            isBelowThreshold: false,
            issue: {
              id: '275',
            },
          },
          {
            isBelowThreshold: false,
            issue: {
              id: '217',
            },
          },
        ],
        filteredSimilarItems: [
          {
            isBelowThreshold: true,
            issue: {
              id: '216',
            },
          },
        ],
        unmergeState: new Map(),
      });
    });

    it('unsuccessfully fetches list of similar items', function () {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: '/issues/groupId/similar/',
        statusCode: 500,
        body: {message: 'failed'},
      });

      const promise = GroupingStore.onFetch([
        {dataKey: 'similar', endpoint: '/issues/groupId/similar/'},
      ]);

      expect(trigger).toHaveBeenCalled();
      const calls = trigger.mock.calls;
      return promise.then(() => {
        const arg = calls[calls.length - 1][0];
        expect(arg).toMatchObject({
          loading: false,
          error: true,
          mergeState: new Map(),
          mergedItems: [],
          unmergeState: new Map(),
        });
      });
    });

    it('ignores null scores in aggregate', async function () {
      await GroupingStore.onFetch([
        {dataKey: 'similar', endpoint: '/issues/groupId/similar/'},
      ]);

      expect(trigger).toHaveBeenCalled();
      const calls = trigger.mock.calls;
      const arg = calls[calls.length - 1][0];

      const item = arg.similarItems.find(({issue}) => issue.id === '217');
      expect(item.aggregate.exception).toBe(0.25);
      expect(item.aggregate.message).toBe(0.7);
    });

    it('fetches list of hashes', function () {
      const promise = GroupingStore.onFetch([
        {dataKey: 'merged', endpoint: '/issues/groupId/hashes/'},
      ]);

      expect(trigger).toHaveBeenCalled();
      const calls = trigger.mock.calls;
      return promise.then(() => {
        const arg = calls[calls.length - 1][0];
        expect(arg.mergedItems).toHaveLength(5);
        expect(arg).toMatchObject({
          loading: false,
          error: false,
          similarItems: [],
          filteredSimilarItems: [],
          mergeState: new Map(),
          unmergeState: new Map([
            ['1', {busy: true}],
            ['2', {busy: false}],
            ['3', {busy: false}],
            ['4', {busy: false}],
            ['5', {busy: true}],
          ]),
        });
      });
    });

    it('unsuccessfully fetches list of hashes items', function () {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: '/issues/groupId/hashes/',
        statusCode: 500,
        body: {message: 'failed'},
      });

      const promise = GroupingStore.onFetch([
        {dataKey: 'merged', endpoint: '/issues/groupId/hashes/'},
      ]);

      expect(trigger).toHaveBeenCalled();
      const calls = trigger.mock.calls;
      return promise.then(() => {
        const arg = calls[calls.length - 1][0];
        expect(arg).toMatchObject({
          loading: false,
          error: true,
          mergeState: new Map(),
          mergedItems: [],
          unmergeState: new Map(),
        });
      });
    });
  });

  describe('Similar Issues list (to be merged)', function () {
    let mergeList;
    let mergeState;

    beforeEach(function () {
      GroupingStore.init();
      mergeList = [];
      mergeState = new Map();
      return GroupingStore.onFetch([
        {dataKey: 'similar', endpoint: '/issues/groupId/similar/'},
      ]);
    });

    describe('onToggleMerge (checkbox state)', function () {
      beforeEach(() => GroupingStore.init());

      // Attempt to check first item but its "locked" so should not be able to do anything
      it('can check and uncheck item', function () {
        GroupingStore.onToggleMerge('1');

        mergeList = ['1'];
        mergeState.set('1', {checked: true});
        expect(GroupingStore.getState().mergeList).toEqual(mergeList);
        expect(GroupingStore.getState().mergeState).toEqual(mergeState);

        // Uncheck
        GroupingStore.onToggleMerge('1');
        mergeList = mergeList.filter(item => item !== '1');
        mergeState.set('1', {checked: false});

        // Check all
        GroupingStore.onToggleMerge('1');
        GroupingStore.onToggleMerge('2');
        GroupingStore.onToggleMerge('3');

        mergeList = ['1', '2', '3'];
        mergeState.set('1', {checked: true});
        mergeState.set('2', {checked: true});
        mergeState.set('3', {checked: true});

        expect(GroupingStore.getState().mergeList).toEqual(mergeList);
        expect(GroupingStore.getState().mergeState).toEqual(mergeState);

        expect(trigger).toHaveBeenLastCalledWith({
          mergeDisabled: false,
          mergeList,
          mergeState,
        });
      });
    });

    describe('onMerge', function () {
      beforeEach(function () {
        MockApiClient.clearMockResponses();
        MockApiClient.addMockResponse({
          method: 'PUT',
          url: '/projects/orgId/projectId/issues/',
        });
        GroupingStore.init();
      });

      it('disables rows to be merged', async function () {
        const mergeMock = jest.spyOn(GroupActionCreators, 'mergeGroups');

        trigger.mockReset();
        GroupingStore.onToggleMerge('1');
        mergeList = ['1'];
        mergeState.set('1', {checked: true});

        expect(trigger).toHaveBeenLastCalledWith({
          mergeDisabled: false,
          mergeList,
          mergeState,
        });

        trigger.mockReset();

        // Everything is sync so trigger will have been called multiple times
        const promise = GroupingStore.onMerge({
          params: {
            orgId: 'orgId',
            groupId: 'groupId',
          },
          projectId: 'projectId',
        });

        mergeState.set('1', {checked: true, busy: true});

        expect(trigger).toHaveBeenCalledWith({
          mergeDisabled: true,
          mergeList,
          mergeState,
        });

        await promise;

        expect(mergeMock).toHaveBeenCalledWith(
          expect.anything(),
          {
            orgId: 'orgId',
            projectId: 'projectId',
            itemIds: ['1', 'groupId'],
            query: undefined,
          },
          {
            error: expect.any(Function),
            success: expect.any(Function),
            complete: expect.any(Function),
          }
        );

        // Should be removed from mergeList after merged
        mergeList = mergeList.filter(item => item !== '1');
        mergeState.set('1', {checked: false, busy: true});
        expect(trigger).toHaveBeenLastCalledWith({
          mergeDisabled: false,
          mergeList,
          mergeState,
        });
      });

      it('keeps rows in "busy" state and unchecks after successfully adding to merge queue', async function () {
        GroupingStore.onToggleMerge('1');
        mergeList = ['1'];
        mergeState.set('1', {checked: true});

        // Expect checked
        expect(trigger).toHaveBeenCalledWith({
          mergeDisabled: false,
          mergeList,
          mergeState,
        });

        trigger.mockReset();

        // Start unmerge
        const promise = GroupingStore.onMerge({
          params: {
            orgId: 'orgId',
            groupId: 'groupId',
          },
          projectId: 'projectId',
        });

        mergeState.set('1', {checked: true, busy: true});

        // Expect checked to remain the same, but is now busy
        expect(trigger).toHaveBeenCalledWith({
          mergeDisabled: true,
          mergeList,
          mergeState,
        });

        await promise;

        mergeState.set('1', {checked: false, busy: true});

        // After promise, reset checked to false, but keep busy
        expect(trigger).toHaveBeenLastCalledWith({
          mergeDisabled: false,
          mergeList: [],
          mergeState,
        });
      });

      it('resets busy state and has same items checked after error when trying to merge', async function () {
        MockApiClient.clearMockResponses();
        MockApiClient.addMockResponse({
          method: 'PUT',
          url: '/projects/orgId/projectId/issues/',
          statusCode: 500,
          body: {},
        });

        GroupingStore.onToggleMerge('1');
        mergeList = ['1'];
        mergeState.set('1', {checked: true});

        const promise = GroupingStore.onMerge({
          params: {
            orgId: 'orgId',
            groupId: 'groupId',
          },
          projectId: 'projectId',
        });

        mergeState.set('1', {checked: true, busy: true});
        expect(trigger).toHaveBeenCalledWith({
          mergeDisabled: true,
          mergeList,
          mergeState,
        });

        await promise;

        // Error state
        mergeState.set('1', {checked: true, busy: false});
        expect(trigger).toHaveBeenLastCalledWith({
          mergeDisabled: false,
          mergeList,
          mergeState,
        });
      });
    });
  });

  describe('Hashes list (to be unmerged)', function () {
    let unmergeList;
    let unmergeState;

    beforeEach(async function () {
      GroupingStore.init();
      unmergeList = new Map();
      unmergeState = new Map();
      await GroupingStore.onFetch([
        {dataKey: 'merged', endpoint: '/issues/groupId/hashes/'},
      ]);

      trigger.mockClear();
      unmergeState = new Map([...GroupingStore.getState().unmergeState]);
    });

    // WARNING: all the tests in this describe block are not running in isolated state.
    // There is a good chance that moving them around will break them. To simulate an isolated state,
    // add a beforeEach(() => GroupingStore.init())
    describe('onToggleUnmerge (checkbox state for hashes)', function () {
      // Attempt to check first item but its "locked" so should not be able to do anything
      it('can not check locked item', function () {
        GroupingStore.onToggleUnmerge('1');

        expect(GroupingStore.getState().unmergeList).toEqual(unmergeList);
        expect(GroupingStore.getState().unmergeState).toEqual(unmergeState);
        expect(trigger).not.toHaveBeenCalled();
      });

      it('can check and uncheck unlocked items', function () {
        // Check
        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        unmergeList.set('2', 'event-2');
        unmergeState.set('2', {busy: false, checked: true});

        expect(GroupingStore.getState().unmergeList).toEqual(unmergeList);
        expect(GroupingStore.getState().unmergeState).toEqual(unmergeState);

        // Uncheck
        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        unmergeList.delete('2');
        unmergeState.set('2', {busy: false, checked: false});

        expect(GroupingStore.getState().unmergeList).toEqual(unmergeList);
        expect(GroupingStore.getState().unmergeState).toEqual(unmergeState);

        // Check
        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        unmergeList.set('2', 'event-2');
        unmergeState.set('2', {busy: false, checked: true});

        expect(GroupingStore.getState().unmergeList).toEqual(unmergeList);
        expect(GroupingStore.getState().unmergeState).toEqual(unmergeState);

        expect(trigger).toHaveBeenLastCalledWith({
          enableFingerprintCompare: false,
          unmergeLastCollapsed: false,
          unmergeDisabled: false,
          unmergeList,
          unmergeState,
        });
      });

      it('should have Compare button enabled only when two fingerprints are checked', function () {
        expect(GroupingStore.getState().enableFingerprintCompare).toBe(false);

        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        GroupingStore.onToggleUnmerge(['3', 'event-3']);
        expect(GroupingStore.getState().enableFingerprintCompare).toBe(true);

        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        expect(GroupingStore.getState().enableFingerprintCompare).toBe(false);
      });

      it('selecting all available checkboxes should disable the unmerge button and re-enable when unchecking', function () {
        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        GroupingStore.onToggleUnmerge(['3', 'event-3']);
        GroupingStore.onToggleUnmerge(['4', 'event-4']);
        unmergeList.set('2', 'event-2');
        unmergeList.set('3', 'event-3');
        unmergeList.set('4', 'event-4');
        unmergeState.set('2', {busy: false, checked: true});
        unmergeState.set('3', {busy: false, checked: true});
        unmergeState.set('4', {busy: false, checked: true});

        expect(GroupingStore.getState().unmergeList).toEqual(unmergeList);
        expect(GroupingStore.getState().unmergeState).toEqual(unmergeState);
        expect(GroupingStore.getState().unmergeDisabled).toBe(true);

        // Unchecking
        GroupingStore.onToggleUnmerge(['4', 'event-4']);
        unmergeList.delete('4');
        unmergeState.set('4', {busy: false, checked: false});

        expect(GroupingStore.getState().unmergeList).toEqual(unmergeList);
        expect(GroupingStore.getState().unmergeState).toEqual(unmergeState);
        expect(GroupingStore.getState().unmergeDisabled).toBe(false);

        expect(trigger).toHaveBeenLastCalledWith({
          enableFingerprintCompare: true,
          unmergeLastCollapsed: false,
          unmergeDisabled: false,
          unmergeList,
          unmergeState,
        });
      });
    });

    // WARNING: all the tests in this describe block are not running in isolated state.
    // There is a good chance that moving them around will break them. To simulate an isolated state,
    // add a beforeEach(() => GroupingStore.init())
    describe('onUnmerge', function () {
      beforeEach(function () {
        MockApiClient.clearMockResponses();
        MockApiClient.addMockResponse({
          method: 'DELETE',
          url: '/organizations/org-slug/issues/groupId/hashes/',
        });
      });

      it('can not toggle unmerge for a locked item', function () {
        // Event 1 is locked
        GroupingStore.onToggleUnmerge(['1', 'event-1']);
        unmergeState.set('1', {busy: true});

        // trigger does NOT get called because an item returned via API is in a "locked" state
        expect(trigger).not.toHaveBeenCalled();

        GroupingStore.onUnmerge({
          orgSlug: 'org-slug',
          groupId: 'groupId',
        });

        expect(trigger).toHaveBeenCalledWith({
          enableFingerprintCompare: false,
          unmergeLastCollapsed: false,
          unmergeDisabled: true,
          unmergeList,
          unmergeState,
        });
      });

      it('disables rows to be merged', async function () {
        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        unmergeList.set('2', 'event-2');
        unmergeState.set('2', {checked: true, busy: false});

        // trigger does NOT get called because an item returned via API is in a "locked" state
        expect(trigger).toHaveBeenCalledWith({
          enableFingerprintCompare: false,
          unmergeLastCollapsed: false,
          unmergeDisabled: false,
          unmergeList,
          unmergeState,
        });

        const promise = GroupingStore.onUnmerge({
          orgSlug: 'org-slug',
          groupId: 'groupId',
        });

        unmergeState.set('2', {checked: false, busy: true});
        expect(trigger).toHaveBeenCalledWith({
          enableFingerprintCompare: false,
          unmergeLastCollapsed: false,
          unmergeDisabled: true,
          unmergeList,
          unmergeState,
        });

        await promise;

        // Success
        unmergeState.set('2', {checked: false, busy: true});
        unmergeList.delete('2');
        expect(trigger).toHaveBeenLastCalledWith({
          enableFingerprintCompare: false,
          unmergeLastCollapsed: false,
          unmergeDisabled: false,
          unmergeList,
          unmergeState,
        });
      });

      it('keeps rows in "busy" state and unchecks after successfully adding to unmerge queue', async function () {
        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        unmergeList.set('2', 'event-2');
        unmergeState.set('2', {checked: true, busy: false});

        const promise = GroupingStore.onUnmerge({
          groupId: 'groupId',
          orgSlug: 'org-slug',
        });

        unmergeState.set('2', {checked: false, busy: true});
        expect(trigger).toHaveBeenCalledWith({
          enableFingerprintCompare: false,
          unmergeLastCollapsed: false,
          unmergeDisabled: true,
          unmergeList,
          unmergeState,
        });

        await promise;

        expect(trigger).toHaveBeenLastCalledWith({
          enableFingerprintCompare: false,
          unmergeLastCollapsed: false,
          unmergeDisabled: false,
          unmergeList: new Map(),
          unmergeState,
        });
      });

      it('resets busy state and has same items checked after error when trying to merge', async function () {
        MockApiClient.clearMockResponses();
        MockApiClient.addMockResponse({
          method: 'DELETE',
          url: '/organizations/org-slug/issues/groupId/hashes/',
          statusCode: 500,
          body: {},
        });

        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        unmergeList.set('2', 'event-2');

        const promise = GroupingStore.onUnmerge({
          groupId: 'groupId',
          orgSlug: 'org-slug',
        });

        unmergeState.set('2', {checked: false, busy: true});
        expect(trigger).toHaveBeenCalledWith({
          enableFingerprintCompare: false,
          unmergeLastCollapsed: false,
          unmergeDisabled: true,
          unmergeList,
          unmergeState,
        });

        await promise;

        unmergeState.set('2', {checked: true, busy: false});
        expect(trigger).toHaveBeenLastCalledWith({
          enableFingerprintCompare: false,
          unmergeLastCollapsed: false,
          unmergeDisabled: false,
          unmergeList,
          unmergeState,
        });
      });
    });
  });
});
