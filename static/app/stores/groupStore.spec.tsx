import {ActorFixture} from 'sentry-fixture/actor';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import GroupStore from 'sentry/stores/groupStore';
import type {TimeseriesValue} from 'sentry/types/core';
import type {Group, GroupStats} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';

const MOCK_PROJECT = ProjectFixture();

const g = (id: string, params?: Partial<Group>): Group => {
  return GroupFixture({id, project: MOCK_PROJECT, ...params});
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

  describe('onPopulateStats()', function () {
    const stats: Record<string, TimeseriesValue[]> = {auto: [[1611576000, 10]]};

    beforeEach(function () {
      jest.spyOn(GroupStore, 'trigger');
      GroupStore.items = [g('1'), g('2'), g('3')];
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should merge stats into existing groups', function () {
      GroupStore.onPopulateStats(
        ['1', '2', '3'],
        [
          {id: '1', stats} as GroupStats,
          {id: '2', stats} as GroupStats,
          {id: '3', stats} as GroupStats,
        ]
      );

      const group = GroupStore.getAllItems()[0] as Group;

      expect(group.stats).toEqual(stats);
      expect(GroupStore.trigger).toHaveBeenCalledWith(new Set(['1', '2', '3']));
    });

    it('should not change current item ids', function () {
      GroupStore.onPopulateStats(
        ['2', '3'],
        [{id: '2', stats} as GroupStats, {id: '3', stats} as GroupStats]
      );

      const group1 = GroupStore.getAllItems()[0] as Group;
      const group2 = GroupStore.getAllItems()[1] as Group;

      expect(GroupStore.trigger).toHaveBeenCalledWith(new Set(['2', '3']));
      expect(group1.stats).not.toEqual(stats);
      expect(group2.stats).toEqual(stats);
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

  describe('getState()', function () {
    it('returns a stable reference', () => {
      GroupStore.add([g('1'), g('2')]);
      const state = GroupStore.getState();
      expect(Object.is(state, GroupStore.getState())).toBe(true);
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
        const assignedGroup = g('1', {assignedTo: ActorFixture()});
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
                project: ProjectFixture(),
                data: {text: 'Orginal Text'},
              },
            ],
          }),
        ];
        GroupStore.updateActivity('1', '1', {text: 'Updated Text'});
        expect(GroupStore.items[0]!.activity[0]!.data).toEqual({text: 'Updated Text'});
      });
    });
  });
});
