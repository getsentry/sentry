/* eslint-env jest */
import SimilarIssuesStore from 'app/stores/similarIssuesStore';
import {loadSimilarIssues} from 'app/actionCreators/groups';
import {mergeSelected} from 'app/actionCreators/similarIssues';
import {Client} from 'app/api';
jest.mock('app/api');

describe('Similar Issues Store', function() {
  let trigger;
  let data = [
    [
      {
        id: '274'
      },
      {
        'exception:stacktrace:pairs': 0.375,
        'exception:stacktrace:application-chunks': 0.175,
        'message:message:character-shingles': 0.675
      }
    ],
    [
      {
        id: '275'
      },
      {'exception:stacktrace:pairs': 1.000}
    ],
    [
      {
        id: '216'
      },
      {
        'exception:stacktrace:application-chunks': 0.000235,
        'exception:stacktrace:pairs': 0.001488
      }
    ]
  ];

  beforeEach(function() {
    trigger = jest.spyOn(SimilarIssuesStore, 'trigger');
    // this.sandbox = sinon.sandbox.create();
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/issues/groupId/similar/',
      body: data
    });
  });

  afterEach(function() {
    // this.sandbox.restore();
    trigger.mockReset();
  });

  describe('onLoadSimilarIssues', function() {
    it('initially gets called with correct state values', function() {
      SimilarIssuesStore.onLoadSimilarIssues();

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

    it('successfully fetches list of similar items', function() {
      SimilarIssuesStore.onLoadSimilarIssuesSuccess(data, null, {
        getResponseHeader: () => ''
      });
      expect(trigger).toBeCalled();
      let calls = trigger.mock.calls;
      let arg = calls[calls.length - 1][0];

      expect(arg.filteredItems.length).toBe(2);
      expect(arg.items.length).toBe(1);
      expect(arg).toMatchObject({
        loading: false,
        error: false,
        itemState: new Map(),
        items: [
          {
            avgScore: 100,
            isBelowThreshold: false,
            issue: {
              id: '275'
            }
          }
        ],
        filteredItems: [
          {
            avgScore: 41,
            isBelowThreshold: true,
            issue: {
              id: '274'
            }
          },
          {
            avgScore: 0,
            isBelowThreshold: true,
            issue: {
              id: '216'
            }
          }
        ]
      });
    });

    it('unsuccessfully fetches list of similar items', function() {
      SimilarIssuesStore.onLoadSimilarIssuesError('error');
      expect(trigger).toBeCalled();
      let calls = trigger.mock.calls;
      let arg = calls[calls.length - 1][0];
      expect(arg).toMatchObject({
        loading: false,
        error: true
      });
    });
  });

  describe('Similar Issues list (to be merged)', function() {
    let selectedSet;
    let itemState;

    beforeEach(function() {
      selectedSet = new Set();
      itemState = new Map();
      SimilarIssuesStore.init();
      loadSimilarIssues(new Client(), {groupId: 'groupId'});
      trigger.mockReset();
    });

    afterEach(function() {
      SimilarIssuesStore.selectedSet = new Set();
    });

    describe('onToggleSelect (checkbox state)', function() {
      // Attempt to check first item but its "locked" so should not be able to do anything
      it('can check and uncheck item', function() {
        SimilarIssuesStore.onToggleSelect('1');

        selectedSet.add('1');
        itemState.set('1', {checked: true});
        expect(SimilarIssuesStore.selectedSet).toEqual(selectedSet);
        expect(SimilarIssuesStore.itemState).toEqual(itemState);

        // Uncheck
        SimilarIssuesStore.onToggleSelect('1');
        selectedSet.delete('1');
        itemState.set('1', {checked: false});

        // Check all
        SimilarIssuesStore.onToggleSelect('1');
        SimilarIssuesStore.onToggleSelect('2');
        SimilarIssuesStore.onToggleSelect('3');

        selectedSet.add('1');
        selectedSet.add('2');
        selectedSet.add('3');
        itemState.set('1', {checked: true});
        itemState.set('2', {checked: true});
        itemState.set('3', {checked: true});

        expect(SimilarIssuesStore.selectedSet).toEqual(selectedSet);
        expect(SimilarIssuesStore.itemState).toEqual(itemState);

        expect(trigger).toHaveBeenLastCalledWith({
          actionButtonEnabled: true,
          selectedSet,
          itemState
        });
      });
    });

    describe('onMerge', function() {
      beforeEach(function() {
        jest.spyOn(Client.prototype, 'merge');
        Client.clearMockResponses();
        Client.addMockResponse({
          method: 'PUT',
          url: '/projects/orgId/projectId/issues/'
        });
      });
      afterEach(function() {});

      // This fails with reflux 0.4.1 because of issues with sync actions
      it.skip('mergeSelected actionCreator calls api.merge', function() {
        SimilarIssuesStore.onToggleSelect('1');

        mergeSelected(new Client(), {
          orgId: 'orgId',
          projectId: 'projectId',
          groupId: 'groupId'
        });

        expect(Client.prototype.merge).toHaveBeenLastCalledWith({
          groupId: 'groupId',
          orgId: 'orgId',
          projectId: 'projectId',
          itemIds: ['1', 'groupId']
        });
      });

      it('keeps rows in "busy" state when starting to add to merge queue', function() {
        SimilarIssuesStore.onToggleSelect('1');
        selectedSet.add('1');
        itemState.set('1', {checked: true, busy: true});

        SimilarIssuesStore.onMerge('uid', ['1']);
        expect(trigger).toHaveBeenCalledWith({
          actionButtonEnabled: false,
          selectedSet,
          itemState
        });
      });

      it('unchecks item after successfully adding to merge queue', function() {
        itemState.set('1', {checked: false, busy: true});

        SimilarIssuesStore.onMergeSuccess('uid', ['1']);
        expect(trigger).toHaveBeenLastCalledWith({
          actionButtonEnabled: true,
          selectedSet: new Set(),
          itemState
        });
      });

      it('resets busy state and has same items checked after error when trying to merge', function() {
        SimilarIssuesStore.onMergeError('uid', ['1']);

        selectedSet.add('1');
        itemState.set('1', {checked: true, busy: false});
        expect(trigger).toHaveBeenCalledWith({
          actionButtonEnabled: true,
          selectedSet,
          itemState
        });
      });
    });
  });
});
