import {GroupingStore} from 'sentry/stores/groupingStore';

describe('Grouping Store', () => {
  let trigger!: jest.SpyInstance;

  beforeAll(() => {
    MockApiClient.asyncDelay = 1;
  });

  afterAll(() => {
    MockApiClient.asyncDelay = undefined;
  });

  beforeEach(() => {
    GroupingStore.init();
    trigger = jest.spyOn(GroupingStore, 'trigger');
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/groupId/hashes/',
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
          mergedBySeer: true,
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
          mergedBySeer: true,
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
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('onFetch()', () => {
    beforeEach(() => GroupingStore.init());

    it('initially gets called with correct state values', () => {
      GroupingStore.onFetch([]);

      expect(trigger).toHaveBeenCalled();
      expect(trigger).toHaveBeenCalledWith(
        expect.objectContaining({
          error: false,
          loading: true,
          mergedItems: [],
          mergedLinks: '',
          unmergeState: new Map(),
        })
      );
    });

    it('fetches list of hashes', () => {
      const promise = GroupingStore.onFetch([
        {dataKey: 'merged', endpoint: '/organizations/org-slug/issues/groupId/hashes/'},
      ]);

      expect(trigger).toHaveBeenCalled();
      const calls = trigger.mock.calls;
      return promise.then(() => {
        const arg = calls[calls.length - 1][0];
        expect(arg.mergedItems).toHaveLength(5);
        expect(arg).toMatchObject({
          loading: false,
          error: false,
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

    it('handles fingerprints with seer merging information', async () => {
      await GroupingStore.onFetch([
        {dataKey: 'merged', endpoint: '/organizations/org-slug/issues/groupId/hashes/'},
      ]);

      expect(trigger).toHaveBeenCalled();
      const mergedItems = GroupingStore.getState().mergedItems;

      // Check that fingerprints with metadata are properly handled
      const fingerprintWithSeer = mergedItems.find((item: any) => item.id === '2');
      expect(fingerprintWithSeer).toBeDefined();
      expect(fingerprintWithSeer?.mergedBySeer).toBe(true);

      const fingerprintWithSeerV2 = mergedItems.find((item: any) => item.id === '4');
      expect(fingerprintWithSeerV2).toBeDefined();
      expect(fingerprintWithSeerV2?.mergedBySeer).toBe(true);

      // Check that fingerprints without seer merging are still handled correctly
      const fingerprintWithoutSeer = mergedItems.find((item: any) => item.id === '3');
      expect(fingerprintWithoutSeer).toBeDefined();
      expect(fingerprintWithoutSeer?.mergedBySeer).toBeUndefined();
    });

    it('unsuccessfully fetches list of hashes items', () => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/groupId/hashes/',
        statusCode: 500,
        body: {message: 'failed'},
      });

      const promise = GroupingStore.onFetch([
        {dataKey: 'merged', endpoint: '/organizations/org-slug/issues/groupId/hashes/'},
      ]);

      expect(trigger).toHaveBeenCalled();
      const calls = trigger.mock.calls;
      return promise.then(() => {
        const arg = calls[calls.length - 1][0];
        expect(arg).toMatchObject({
          loading: false,
          error: true,
          mergedItems: [],
          unmergeState: new Map(),
        });
      });
    });
  });

  describe('Hashes list (to be unmerged)', () => {
    let unmergeList: (typeof GroupingStore)['state']['unmergeList'];
    let unmergeState: (typeof GroupingStore)['state']['unmergeState'];

    beforeEach(async () => {
      GroupingStore.init();
      unmergeList = new Map();
      unmergeState = new Map();
      await GroupingStore.onFetch([
        {dataKey: 'merged', endpoint: '/organizations/org-slug/issues/groupId/hashes/'},
      ]);

      trigger.mockClear();
      unmergeState = new Map([...GroupingStore.getState().unmergeState]);
    });

    // WARNING: all the tests in this describe block are not running in isolated state.
    // There is a good chance that moving them around will break them. To simulate an isolated state,
    // add a beforeEach(() => GroupingStore.init())
    describe('onToggleUnmerge (checkbox state for hashes)', () => {
      // Attempt to check first item but its "locked" so should not be able to do anything
      it('can not check locked item', () => {
        GroupingStore.onToggleUnmerge('1');

        expect(GroupingStore.getState().unmergeList).toEqual(unmergeList);
        expect(GroupingStore.getState().unmergeState).toEqual(unmergeState);
        expect(trigger).not.toHaveBeenCalled();
      });

      it('can check and uncheck unlocked items', () => {
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

        expect(trigger).toHaveBeenLastCalledWith(
          expect.objectContaining({
            enableFingerprintCompare: false,
            unmergeLastCollapsed: false,
            unmergeDisabled: false,
            unmergeList,
            unmergeState,
          })
        );
      });

      it('should have Compare button enabled only when two fingerprints are checked', () => {
        expect(GroupingStore.getState().enableFingerprintCompare).toBe(false);

        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        GroupingStore.onToggleUnmerge(['3', 'event-3']);
        expect(GroupingStore.getState().enableFingerprintCompare).toBe(true);

        GroupingStore.onToggleUnmerge(['2', 'event-2']);
        expect(GroupingStore.getState().enableFingerprintCompare).toBe(false);
      });

      it('selecting all available checkboxes should disable the unmerge button and re-enable when unchecking', () => {
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
    describe('onUnmerge', () => {
      beforeEach(() => {
        MockApiClient.clearMockResponses();
        MockApiClient.addMockResponse({
          method: 'PUT',
          url: '/organizations/org-slug/issues/groupId/hashes/',
        });
      });

      it('can not toggle unmerge for a locked item', () => {
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

      it('disables rows to be merged', async () => {
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

      it('keeps rows in "busy" state and unchecks after successfully adding to unmerge queue', async () => {
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

      it('resets busy state and has same items checked after error when trying to merge', async () => {
        MockApiClient.clearMockResponses();
        MockApiClient.addMockResponse({
          method: 'PUT',
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
        expect(trigger).toHaveBeenCalledWith(
          expect.objectContaining({
            enableFingerprintCompare: false,
            unmergeLastCollapsed: false,
            unmergeDisabled: true,
            unmergeList,
            unmergeState,
          })
        );

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
