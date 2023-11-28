import {Project} from 'sentry-fixture/project';

import GroupStore from 'sentry/stores/groupStore';
import {Group, GroupActivityType} from 'sentry/types';

const MOCK_PROJECT = TestStubs.Project();

const g = (id: string, params?: Partial<Group>): Group => {
  return TestStubs.Group({id, project: MOCK_PROJECT, ...params});
};

describe('GroupStore', function () {
  beforeEach(function () {
    GroupStore.reset();
  });

  describe('add()', function () {
    it('should add new entries', function () {
      GroupStore.items = [];
      GroupStore.add([g('1'), g('2')]);

      expect(GroupStore.items).toEqual([g('1'), g('2')]);
    });

    it('should update matching existing entries', function () {
      GroupStore.items = [g('1'), g('2')];

      GroupStore.add([g('1', {count: '1337'}), g('3')]);

      expect(GroupStore.getAllItemIds()).toEqual(['1', '2', '3']);
      expect(GroupStore.items[0]).toEqual(
        expect.objectContaining({id: '1', count: '1337'})
      );
    });

    it('should attempt to preserve order of ids', function () {
      GroupStore.add([g('2'), g('1'), g('3')]);
      expect(GroupStore.getAllItemIds()).toEqual(['2', '1', '3']);
    });
  });

  describe('addToFront()', function () {
    it('should add new entries to beginning of the list', function () {
      GroupStore.items = [g('2')];
      GroupStore.addToFront([g('1'), g('3')]);

      expect(GroupStore.items).toEqual([g('1'), g('3'), g('2')]);
    });

    it('should update matching existing entries', function () {
      GroupStore.items = [g('1'), g('2')];

      GroupStore.addToFront([g('1', {count: '1337'}), g('3')]);

      expect(GroupStore.getAllItems()).toEqual([
        expect.objectContaining({id: '1', count: '1337'}),
        g('3'),
        g('2'),
      ]);
    });

    it('should attempt to preserve order of ids', function () {
      GroupStore.addToFront([g('2'), g('1'), g('3')]);
      expect(GroupStore.getAllItemIds()).toEqual(['2', '1', '3']);
    });
  });

  describe('remove()', function () {
    it('should remove entry', function () {
      GroupStore.items = [g('1'), g('2')];
      GroupStore.remove(['1']);

      expect(GroupStore.items).toEqual([g('2')]);
    });

    it('should remove multiple entries', function () {
      GroupStore.items = [g('1'), g('2'), g('3')];
      GroupStore.remove(['1', '2']);

      expect(GroupStore.items).toEqual([g('3')]);
    });

    it('should not remove already removed item', function () {
      GroupStore.items = [g('1'), g('2')];
      GroupStore.remove(['0']);

      expect(GroupStore.items).toEqual([g('1'), g('2')]);
    });
  });

  describe('onMergeSuccess()', function () {
    it('should remove the non-parent merged ids', function () {
      GroupStore.items = [g('1'), g('2'), g('3'), g('4')];

      GroupStore.onMergeSuccess(
        '',
        ['2', '3', '4'], // items merged
        {merge: {parent: '3'}} // merge API response
      );

      expect(GroupStore.items).toEqual([
        g('1'),
        g('3'), // parent
      ]);
    });
  });

  describe('getAllItems()', function () {
    it('Merges pending changes into items', function () {
      GroupStore.items = [];
      GroupStore.add([g('1'), g('2')]);

      GroupStore.onUpdate('1337', ['1'], {someChange: true});

      expect(GroupStore.get('1')).toEqual(
        expect.objectContaining({id: '1', someChange: true})
      );
    });
  });

  describe('update methods', function () {
    beforeEach(function () {
      jest.spyOn(GroupStore, 'trigger');
      GroupStore.items = [g('1'), g('2'), g('3')];
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('onUpdate()', function () {
      it("should treat undefined itemIds argument as 'all'", function () {
        GroupStore.onUpdate('1337', undefined, {});

        expect(GroupStore.trigger).toHaveBeenCalledTimes(1);
        expect(GroupStore.trigger).toHaveBeenCalledWith(new Set(['1', '2', '3']));
      });
      it('should apply optimistic updates', function () {
        GroupStore.items = [g('1'), g('2')];
        GroupStore.add([g('1'), g('2')]);

        // Resolve 2 issues
        const itemIds = ['1', '2'];
        const data = {status: 'resolved', statusDetails: {}};
        GroupStore.onUpdate('12345', itemIds, data);

        expect(GroupStore.pendingChanges).toEqual(new Map([['12345', {itemIds, data}]]));
        expect(GroupStore.get('1')).toEqual({...g('1'), ...data});
        expect(GroupStore.get('2')).toEqual({...g('2'), ...data});
      });
    });

    describe('onUpdateSuccess()', function () {
      it("should treat undefined itemIds argument as 'all'", function () {
        GroupStore.onUpdateSuccess('1337', undefined, {});

        expect(GroupStore.trigger).toHaveBeenCalledTimes(1);
        expect(GroupStore.trigger).toHaveBeenCalledWith(new Set(['1', '2', '3']));
      });
    });

    describe('onUpdateError()', function () {
      it("should treat undefined itemIds argument as 'all'", function () {
        GroupStore.onUpdateError('1337', undefined, false);

        expect(GroupStore.trigger).toHaveBeenCalledTimes(1);
        expect(GroupStore.trigger).toHaveBeenCalledWith(new Set(['1', '2', '3']));
      });
    });

    describe('onDeleteSuccess()', function () {
      it("should treat undefined itemIds argument as 'all'", function () {
        GroupStore.onDeleteSuccess('1337', undefined, {});

        expect(GroupStore.trigger).toHaveBeenCalledTimes(1);
        expect(GroupStore.trigger).toHaveBeenCalledWith(new Set(['1', '2', '3']));
      });
    });

    describe('onAssignToSuccess()', function () {
      it("should treat undefined itemIds argument as 'all'", function () {
        GroupStore.items = [g('1')];
        const assignedGroup = g('1', {assignedTo: TestStubs.User({type: 'user'})});
        GroupStore.onAssignToSuccess('1337', '1', assignedGroup);

        expect(GroupStore.trigger).toHaveBeenCalledTimes(1);
        expect(GroupStore.trigger).toHaveBeenCalledWith(new Set(['1']));
        expect(GroupStore.items[0]).toEqual(assignedGroup);
      });
    });

    describe('updateActivity()', function () {
      it("should update activity data text'", function () {
        GroupStore.items = [
          g('1', {
            activity: [
              {
                id: '1',
                type: GroupActivityType.NOTE,
                dateCreated: '',
                project: Project(),
                data: {text: 'Orginal Text'},
              },
            ],
          }),
        ];
        GroupStore.updateActivity('1', '1', {text: 'Updated Text'});
        expect(GroupStore.items[0].activity[0].data).toEqual({text: 'Updated Text'});
      });
    });
  });
});
