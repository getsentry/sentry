/* eslint-env jest */
import MergedEventsStore from 'app/stores/mergedEventsStore';
import {unmergeSelected} from 'app/actionCreators/mergedEvents';
import {Client} from 'app/api';
jest.mock('app/api');

describe('Merged Events Store', function() {
  let trigger;
  let data = [
    {
      latestEvent: {
        eventID: 'event-1'
      },
      state: 'locked',
      id: '1'
    },
    {
      latestEvent: {
        eventID: 'event-2'
      },
      state: 'unlocked',
      id: '2'
    },
    {
      latestEvent: {
        eventID: 'event-3'
      },
      state: 'unlocked',
      id: '3'
    },
    {
      latestEvent: {
        eventID: 'event-4'
      },
      state: 'unlocked',
      id: '4'
    },
    {
      latestEvent: {
        eventID: 'event-5'
      },
      state: 'locked',
      id: '5'
    }
  ];

  beforeEach(function() {
    trigger = jest.spyOn(MergedEventsStore, 'trigger');
    // this.sandbox = sinon.sandbox.create();
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/issues/groupId/hashes/',
      body: data
    });
  });

  afterEach(function() {
    // this.sandbox.restore();
    trigger.mockReset();
  });

  describe('onLoadMergedEvents', function() {
    it('initially gets called with correct state values', function() {
      MergedEventsStore.onLoadMergedEvents();
      expect(trigger).toBeCalled();
      expect(trigger).toBeCalledWith(
        expect.objectContaining({
          error: false,
          loading: true,
          itemState: new Map(),
          items: [],
          links: ''
        })
      );
    });

    it('successfully fetches list of merged events', function() {
      MergedEventsStore.onLoadMergedEventsSuccess(data, null, {
        getResponseHeader: () => ''
      });

      expect(trigger).toBeCalled();
      let calls = trigger.mock.calls;
      let arg = calls[calls.length - 1][0];
      expect(arg.items.length).toBe(5);
      expect(arg).toMatchObject({
        loading: false,
        error: false,
        itemState: new Map([
          ['1', {busy: true}],
          ['2', {busy: false}],
          ['3', {busy: false}],
          ['4', {busy: false}],
          ['5', {busy: true}]
        ])
      });
    });

    it('unsuccessfully fetches list of merged events', function() {
      MergedEventsStore.onLoadMergedEventsError('error');
      expect(trigger).toBeCalled();
      let calls = trigger.mock.calls;
      let arg = calls[calls.length - 1][0];
      expect(arg).toMatchObject({
        loading: false,
        error: true
      });
    });
  });

  describe('Hashes list (to be unmerged)', function() {
    let selectedSet;
    let itemState;

    beforeEach(function() {
      selectedSet = new Set();
      MergedEventsStore.init();
      MergedEventsStore.onLoadMergedEventsSuccess(data, null, {
        getResponseHeader: () => ''
      });
      itemState = new Map([...MergedEventsStore.itemState]);
      trigger.mockReset();
    });

    afterEach(function() {
      MergedEventsStore.selectedSet = new Set();
    });

    describe('onToggleSelect (checkbox state for hashes)', function() {
      // Attempt to check first item but its "locked" so should not be able to do anything
      it('can not check locked item', function() {
        MergedEventsStore.onToggleSelect('1');

        expect(MergedEventsStore.selectedSet).toEqual(selectedSet);
        expect(MergedEventsStore.itemState).toEqual(itemState);
        expect(trigger).not.toHaveBeenCalled();
      });

      it('can check and uncheck unlocked items', function() {
        // Check
        MergedEventsStore.onToggleSelect('2');
        selectedSet.add('2');
        itemState.set('2', {busy: false, checked: true});

        expect(MergedEventsStore.selectedSet).toEqual(selectedSet);
        expect(MergedEventsStore.itemState).toEqual(itemState);

        // Uncheck
        MergedEventsStore.onToggleSelect('2');
        selectedSet.delete('2');
        itemState.set('2', {busy: false, checked: false});

        expect(MergedEventsStore.selectedSet).toEqual(selectedSet);
        expect(MergedEventsStore.itemState).toEqual(itemState);

        // Check
        MergedEventsStore.onToggleSelect('2');
        selectedSet.add('2');
        itemState.set('2', {busy: false, checked: true});

        expect(MergedEventsStore.selectedSet).toEqual(selectedSet);
        expect(MergedEventsStore.itemState).toEqual(itemState);

        expect(trigger).toHaveBeenLastCalledWith({
          actionButtonEnabled: true,
          selectedSet,
          itemState
        });
      });

      it('selecting the second to last available checkbox should disable the remaining checkbox and re-enable when unchecking', function() {
        MergedEventsStore.onToggleSelect('3');
        MergedEventsStore.onToggleSelect('4');
        selectedSet.add('3');
        selectedSet.add('4');
        itemState.set('3', {busy: false, checked: true});
        itemState.set('4', {busy: false, checked: true});
        itemState.set('2', {busy: false, disabled: true});

        expect(MergedEventsStore.remainingItem).toMatchObject({
          id: '2'
        });
        expect(MergedEventsStore.selectedSet).toEqual(selectedSet);
        expect(MergedEventsStore.itemState).toEqual(itemState);

        // Unchecking
        MergedEventsStore.onToggleSelect('4');
        selectedSet.delete('4');
        itemState.set('4', {busy: false, checked: false});
        itemState.set('2', {busy: false, disabled: false});

        expect(MergedEventsStore.remainingItem).toBe(null);
        expect(MergedEventsStore.selectedSet).toEqual(selectedSet);
        expect(MergedEventsStore.itemState).toEqual(itemState);

        expect(trigger).toHaveBeenLastCalledWith({
          actionButtonEnabled: true,
          selectedSet,
          itemState
        });
      });
    });

    describe('onUnmerge', function() {
      beforeEach(function() {
        Client.clearMockResponses();
        Client.addMockResponse({
          method: 'DELETE',
          url: '/issues/groupId/hashes/'
        });
      });
      afterEach(function() {});

      // This fails with reflux 0.4.1 because of issues with sync actions
      it.skip('disables rows to be merged', function() {
        MergedEventsStore.onToggleSelect('1');

        unmergeSelected(new Client(), {
          orgId: 'orgId',
          projectId: 'projectId'
        });

        expect(Client.prototype.unmerge).toHaveBeenCalledWith({
          orgId: 'orgId',
          projectId: 'projectId',
          itemIds: ['1']
        });
      });

      it('keeps rows in "busy" state when starting to add to unmerge queue', function() {
        MergedEventsStore.onToggleSelect('1');
        selectedSet.add('1');
        itemState.set('1', {checked: true, busy: false});

        MergedEventsStore.onUnmerge('uid', ['1']);
        expect(trigger).toHaveBeenCalledWith({
          actionButtonEnabled: false,
          unmergeStatus: 'started',
          selectedSet,
          itemState
        });
      });

      it('unchecks item after successfully adding to merge queue', function() {
        itemState.set('1', {checked: false, busy: true});

        MergedEventsStore.onUnmergeSuccess('uid', ['1']);
        expect(trigger).toHaveBeenLastCalledWith({
          actionButtonEnabled: true,
          unmergeStatus: 'success',
          selectedSet: new Set(),
          itemState
        });
      });

      it('resets busy state and has same items checked after error when trying to merge', function() {
        MergedEventsStore.onUnmergeError('uid', ['1']);

        selectedSet.add('1');
        itemState.set('1', {checked: true, busy: false});
        expect(trigger).toHaveBeenCalledWith({
          actionButtonEnabled: true,
          unmergeStatus: 'error',
          selectedSet,
          itemState
        });
      });
    });
  });
});
