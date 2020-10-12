import GroupStore from 'app/stores/groupStore';
import SelectedGroupStore from 'app/stores/selectedGroupStore';

describe('SelectedGroupStore', function () {
  let trigger;

  beforeEach(function () {
    SelectedGroupStore.records = {};

    trigger = jest.spyOn(SelectedGroupStore, 'trigger').mockImplementation(() => {});
  });

  afterEach(function () {
    SelectedGroupStore.trigger.mockRestore();
  });

  describe('prune()', function () {
    it('removes records no longer in the GroupStore', function () {
      jest.spyOn(GroupStore, 'getAllItemIds').mockImplementation(() => ['3']);
      SelectedGroupStore.records = {1: true, 2: true, 3: true};
      SelectedGroupStore.prune();
      expect(SelectedGroupStore.records).toEqual({3: true});
    });

    it("doesn't have any effect when already in sync", function () {
      jest.spyOn(GroupStore, 'getAllItemIds').mockImplementation(() => ['1', '2', '3']);
      SelectedGroupStore.records = {1: true, 2: true, 3: true};
      SelectedGroupStore.prune();
      expect(SelectedGroupStore.records).toEqual({1: true, 2: true, 3: true});
    });
  });

  describe('add()', function () {
    it("defaults value of new ids to 'allSelected()'", function () {
      SelectedGroupStore.records = {1: true};
      SelectedGroupStore.add([2]);
      expect(SelectedGroupStore.records).toEqual({1: true, 2: true});
    });

    it('does not update existing ids', function () {
      SelectedGroupStore.records = {1: false, 2: true};
      SelectedGroupStore.add([3]);
      expect(SelectedGroupStore.records).toEqual({1: false, 2: true, 3: false});
    });
  });

  describe('onGroupChange()', function () {
    let prune;
    let add;

    beforeEach(function () {
      prune = jest.spyOn(SelectedGroupStore, 'prune');
      add = jest.spyOn(SelectedGroupStore, 'add');
    });

    afterEach(function () {});

    it('adds new ids', function () {
      SelectedGroupStore.onGroupChange([]);
      expect(add).toHaveBeenCalled();
    });

    it('prunes stale records', function () {
      SelectedGroupStore.onGroupChange([]);
      expect(prune).toHaveBeenCalled();
    });

    it('triggers an update', function () {
      SelectedGroupStore.onGroupChange([]);
      expect(trigger).toHaveBeenCalled();
    });
  });

  describe('allSelected()', function () {
    it('returns true when all ids are selected', function () {
      SelectedGroupStore.records = {1: true, 2: true};
      expect(SelectedGroupStore.allSelected()).toBe(true);
    });

    it('returns false when some ids are selected', function () {
      SelectedGroupStore.records = {1: true, 2: false};
      expect(SelectedGroupStore.allSelected()).toBe(false);
    });

    it('returns false when no ids are selected', function () {
      SelectedGroupStore.records = {1: false, 2: false};
      expect(SelectedGroupStore.allSelected()).toBe(false);
    });

    it('returns false when there are no ids', function () {
      expect(SelectedGroupStore.allSelected()).toBe(false);
    });
  });

  describe('anySelected()', function () {
    it('returns true if any ids are selected', function () {
      SelectedGroupStore.records = {1: true, 2: false};
      expect(SelectedGroupStore.anySelected()).toBe(true);
    });

    it('returns false when no ids are selected', function () {
      SelectedGroupStore.records = {1: false, 2: false};
      expect(SelectedGroupStore.anySelected()).toBe(false);
    });
  });

  describe('multiSelected()', function () {
    it('returns true when multiple ids are selected', function () {
      SelectedGroupStore.records = {1: true, 2: true, 3: false};
      expect(SelectedGroupStore.multiSelected()).toBe(true);
    });

    it('returns false when a single id is selected', function () {
      SelectedGroupStore.records = {1: true, 2: false};
      expect(SelectedGroupStore.multiSelected()).toBe(false);
    });

    it('returns false when no ids are selected', function () {
      SelectedGroupStore.records = {1: false, 2: false};
      expect(SelectedGroupStore.multiSelected()).toBe(false);
    });
  });

  describe('getSelectedIds()', function () {
    it('returns selected ids', function () {
      SelectedGroupStore.records = {1: true, 2: false, 3: true};
      const ids = SelectedGroupStore.getSelectedIds();

      expect(ids.has('1')).toBe(true);
      expect(ids.has('3')).toBe(true);
      expect(ids.size).toEqual(2);
    });

    it('returns empty set with no selected ids', function () {
      SelectedGroupStore.records = {1: false};
      const ids = SelectedGroupStore.getSelectedIds();

      expect(ids.has('1')).toBe(false);
      expect(ids.size).toEqual(0);
    });
  });

  describe('isSelected()', function () {
    it('returns true if id is selected', function () {
      SelectedGroupStore.records = {1: true};
      expect(SelectedGroupStore.isSelected(1)).toBe(true);
    });

    it('returns false if id is unselected or unknown', function () {
      SelectedGroupStore.records = {1: false};
      expect(SelectedGroupStore.isSelected(1)).toBe(false);
      expect(SelectedGroupStore.isSelected(2)).toBe(false);
      expect(SelectedGroupStore.isSelected()).toBe(false);
    });
  });

  describe('deselectAll()', function () {
    it('sets all records to false', function () {
      SelectedGroupStore.records = {1: true, 2: true, 3: false};
      SelectedGroupStore.deselectAll();
      expect(SelectedGroupStore.records).toEqual({1: false, 2: false, 3: false});
    });

    it('triggers an update', function () {
      SelectedGroupStore.deselectAll();
      expect(trigger).toHaveBeenCalled();
    });
  });

  describe('toggleSelect()', function () {
    it('toggles state given pre-existing id', function () {
      SelectedGroupStore.records = {1: true};
      SelectedGroupStore.toggleSelect(1);
      expect(SelectedGroupStore.records[1]).toBe(false);
    });

    it('does not toggle state given unknown id', function () {
      SelectedGroupStore.toggleSelect(1);
      SelectedGroupStore.toggleSelect();
      SelectedGroupStore.toggleSelect(undefined);
      expect(SelectedGroupStore.records).toEqual({});
    });

    it('triggers an update given pre-existing id', function () {
      SelectedGroupStore.records = {1: true};
      SelectedGroupStore.toggleSelect(1);
      expect(trigger).toHaveBeenCalled();
    });

    it('does not trigger an update given unknown id', function () {
      SelectedGroupStore.toggleSelect();
      expect(trigger).not.toHaveBeenCalled();
    });
  });

  describe('toggleSelectAll()', function () {
    it('selects all ids if any are unselected', function () {
      SelectedGroupStore.records = {1: true, 2: false};
      SelectedGroupStore.toggleSelectAll();
      expect(SelectedGroupStore.records).toEqual({1: true, 2: true});
    });

    it('unselects all ids if all are selected', function () {
      SelectedGroupStore.records = {1: true, 2: true};
      SelectedGroupStore.toggleSelectAll();
      expect(SelectedGroupStore.records).toEqual({1: false, 2: false});
    });

    it('triggers an update', function () {
      SelectedGroupStore.toggleSelectAll();
      expect(trigger).toHaveBeenCalled();
    });
  });
});
