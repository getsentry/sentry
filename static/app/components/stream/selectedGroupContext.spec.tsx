import {reactHooks} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import {Group} from 'sentry/types';

import {SelectedGroupProvider, useSelectedGroups} from './selectedGroupContext';

describe('SelectedGroupContext', function () {
  const renderHook = () =>
    reactHooks.renderHook(() => useSelectedGroups(), {wrapper: SelectedGroupProvider});

  const makeGroup = (id: string, params?: Partial<Group>) =>
    TestStubs.Group({id, ...params});

  describe('GroupStore', function () {
    it('syncs', function () {
      const {result} = renderHook();
      expect(Object.keys(result.current.records)).toEqual([]);

      reactHooks.act(() => GroupStore.add([makeGroup('1')]));
      expect(Object.keys(result.current.records)).toEqual(['1']);
      expect([...result.current.selectedIds]).toEqual([]);
    });
  });

  describe('allSelected()', function () {
    it('returns true when all ids are selected', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        result.current.add(['1', '2']);
        result.current.toggleSelect('1');
        result.current.toggleSelect('2');
      });
      expect(result.current.allSelected).toBe(true);
    });

    it('returns false when some ids are selected', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        result.current.add(['1', '2']);
        result.current.toggleSelect('1');
      });
      expect(result.current.allSelected).toBe(false);
    });

    it('returns false when no ids are selected', function () {
      const {result} = renderHook();

      reactHooks.act(() => result.current.add(['1', '2']));
      expect(result.current.allSelected).toBe(false);
    });

    it('returns false when there are no ids', function () {
      const {result} = renderHook();
      expect(result.current.allSelected).toBe(false);
    });
  });

  describe('anySelected', function () {
    it('returns true if any ids are selected', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        result.current.add(['1', '2']);
        result.current.toggleSelect('1');
      });
      expect(result.current.anySelected).toBe(true);
    });

    it('returns false when no ids are selected', function () {
      const {result} = renderHook();

      reactHooks.act(() => result.current.add(['1', '2']));
      expect(result.current.anySelected).toBe(false);
    });
  });

  describe('multiSelected', function () {
    it('returns true when multiple ids are selected', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        result.current.add(['1', '2', '3']);
        result.current.toggleSelect('1');
        result.current.toggleSelect('2');
      });
      expect(result.current.multiSelected).toBe(true);
    });

    it('returns false when a single id is selected', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        result.current.add(['1', '2', '3']);
        result.current.toggleSelect('1');
      });
      expect(result.current.multiSelected).toBe(false);
    });

    it('returns false when no ids are selected', function () {
      const {result} = renderHook();

      reactHooks.act(() => result.current.add(['1', '2', '3']));
      expect(result.current.multiSelected).toBe(false);
    });
  });

  describe('deselectAll()', function () {
    it('sets all records to false', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        result.current.add(['1', '2', '3']);
        result.current.toggleSelect('1');
        result.current.toggleSelect('2');
      });
      expect([...result.current.selectedIds]).toEqual(['1', '2']);

      reactHooks.act(() => result.current.deselectAll());
      expect([...result.current.selectedIds]).toEqual([]);
    });
  });

  describe('toggleSelect()', function () {
    it('toggles state given pre-existing id', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        result.current.add(['1']);
        result.current.toggleSelect('1');
      });
      expect(result.current.allSelected).toBe(true);
      expect([...result.current.selectedIds]).toEqual(['1']);
    });

    it('does not toggle state given unknown id', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        result.current.add(['1']);
        result.current.toggleSelect('');
      });
      expect([...result.current.selectedIds]).toEqual([]);
    });
  });

  describe('toggleSelectAll()', function () {
    it('selects all ids if any are unselected', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        result.current.add(['1', '2']);
        result.current.toggleSelect('1');
      });
      expect(result.current.allSelected).toBe(false);
      expect([...result.current.selectedIds]).toEqual(['1']);

      reactHooks.act(() => result.current.toggleSelectAll());
      expect(result.current.allSelected).toBe(true);
      expect([...result.current.selectedIds]).toEqual(['1', '2']);
    });

    it('unselects all ids if all are selected', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        result.current.add(['1', '2']);
        result.current.toggleSelect('1');
        result.current.toggleSelect('2');
      });
      expect(result.current.allSelected).toBe(true);
      expect([...result.current.selectedIds]).toEqual(['1', '2']);

      reactHooks.act(() => result.current.toggleSelectAll());
      expect(result.current.anySelected).toBe(false);
      expect([...result.current.selectedIds]).toEqual([]);
    });
  });

  describe('shiftSelectItems()', function () {
    // XXX: IDs do not need to be in any particular order
    const ids = ['11', '13', '12', '14', '15'];

    // XXX: Shift selects relies on the order from GroupStore
    afterEach(() => GroupStore.reset());

    it('toggles all between last selected and new selection', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        GroupStore.add(ids.map(id => makeGroup(id)));
        result.current.toggleSelect('13');
        result.current.shiftToggleItems('14');
      });
      expect([...result.current.selectedIds]).toEqual(['12', '13', '14']);
    });

    it('toggles all between last selected and new selection backwards', function () {
      const {result} = renderHook();

      reactHooks.act(() => {
        GroupStore.add(ids.map(id => makeGroup(id)));
        result.current.toggleSelect('14');
        result.current.shiftToggleItems('13');
      });

      expect([...result.current.selectedIds]).toEqual(['12', '13', '14']);
    });

    it('deslects after selecting', function () {
      const {result} = renderHook();

      // Select everything
      reactHooks.act(() => {
        GroupStore.add(ids.map(id => makeGroup(id)));
        result.current.toggleSelect('11');
        result.current.shiftToggleItems('15');
      });
      expect([...result.current.selectedIds]).toEqual(['11', '12', '13', '14', '15']);

      // Deslect between selection (15) and 13
      reactHooks.act(() => result.current.shiftToggleItems('13'));
      expect([...result.current.selectedIds]).toEqual(['11']);
    });
  });
});
