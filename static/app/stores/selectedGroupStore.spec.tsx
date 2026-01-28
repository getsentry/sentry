import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';

function setRecords(records: Record<string, boolean>) {
  SelectedGroupStore.onGroupChange(new Set(Object.keys(records)));
  for (const [key, isSelected] of Object.entries(records)) {
    if (isSelected) {
      SelectedGroupStore.toggleSelect(key);
    }
  }
}

describe('SelectedGroupStore', () => {
  let trigger: jest.SpyInstance;

  beforeEach(() => {
    SelectedGroupStore.init();
    trigger = jest.spyOn(SelectedGroupStore, 'trigger').mockImplementation(() => {});
  });

  afterEach(() => {
    trigger.mockRestore();
  });

  describe('prune()', () => {
    it('removes records no longer in the GroupStore', () => {
      jest.spyOn(GroupStore, 'getAllItemIds').mockImplementation(() => ['3']);
      setRecords({1: true, 2: true, 3: true});
      SelectedGroupStore.prune();
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([['3', true]]);
    });

    it("doesn't have any effect when already in sync", () => {
      jest.spyOn(GroupStore, 'getAllItemIds').mockImplementation(() => ['1', '2', '3']);
      setRecords({1: true, 2: true, 3: true});
      SelectedGroupStore.prune();
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([
        ['1', true],
        ['2', true],
        ['3', true],
      ]);
    });
  });

  describe('add()', () => {
    it("defaults value of new ids to 'allSelected()'", () => {
      setRecords({1: true});
      SelectedGroupStore.add(['2']);
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([
        ['1', true],
        ['2', true],
      ]);
    });

    it('does not update existing ids', () => {
      setRecords({1: false, 2: true});
      SelectedGroupStore.add(['3']);
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([
        ['1', false],
        ['2', true],
        ['3', false],
      ]);
    });
  });

  describe('onGroupChange()', () => {
    let prune: jest.SpyInstance;
    let add: jest.SpyInstance;

    beforeEach(() => {
      prune = jest.spyOn(SelectedGroupStore, 'prune');
      add = jest.spyOn(SelectedGroupStore, 'add');
    });

    afterEach(() => {});

    it('adds new ids', () => {
      SelectedGroupStore.onGroupChange(new Set());
      expect(add).toHaveBeenCalled();
    });

    it('prunes stale records', () => {
      SelectedGroupStore.onGroupChange(new Set());
      expect(prune).toHaveBeenCalled();
    });

    it('triggers an update', () => {
      SelectedGroupStore.onGroupChange(new Set());
      expect(trigger).toHaveBeenCalled();
    });
  });
  describe('deselectAll()', () => {
    it('sets all records to false', () => {
      setRecords({1: true, 2: true, 3: false});
      SelectedGroupStore.deselectAll();
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([
        ['1', false],
        ['2', false],
        ['3', false],
      ]);
    });

    it('triggers an update', () => {
      SelectedGroupStore.deselectAll();
      expect(trigger).toHaveBeenCalled();
    });
  });

  describe('toggleSelect()', () => {
    it('toggles state given pre-existing id', () => {
      setRecords({1: true});
      SelectedGroupStore.toggleSelect('1');
      expect(SelectedGroupStore.getState().records.get('1')).toBe(false);
    });

    it('does not toggle state given unknown id', () => {
      SelectedGroupStore.toggleSelect('1');
      SelectedGroupStore.toggleSelect('');
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([]);
    });

    it('triggers an update given pre-existing id', () => {
      setRecords({1: true});
      SelectedGroupStore.toggleSelect('1');
      expect(trigger).toHaveBeenCalled();
    });

    it('does not trigger an update given unknown id', () => {
      SelectedGroupStore.toggleSelect('');
      expect(trigger).not.toHaveBeenCalled();
    });
  });

  describe('toggleSelectAll()', () => {
    it('selects all ids if any are unselected', () => {
      setRecords({1: true, 2: false});
      SelectedGroupStore.toggleSelectAll();
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([
        ['1', true],
        ['2', true],
      ]);
    });

    it('unselects all ids if all are selected', () => {
      setRecords({1: true, 2: true});
      SelectedGroupStore.toggleSelectAll();
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([
        ['1', false],
        ['2', false],
      ]);
    });

    it('triggers an update', () => {
      SelectedGroupStore.toggleSelectAll();
      expect(trigger).toHaveBeenCalled();
    });
  });

  describe('shiftSelectItems()', () => {
    it('toggles all between last selected and new selection', () => {
      const ids = ['11', '12', '13', '14', '15'];
      jest.spyOn(GroupStore, 'getAllItemIds').mockImplementation(() => ids);
      SelectedGroupStore.add(ids);
      SelectedGroupStore.toggleSelect('12');
      SelectedGroupStore.shiftToggleItems('14');
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([
        ['11', false],
        ['12', true],
        ['13', true],
        ['14', true],
        ['15', false],
      ]);
    });
    it('toggles all between last selected and new selection backwards', () => {
      const ids = ['11', '12', '13', '14', '15'];
      jest.spyOn(GroupStore, 'getAllItemIds').mockImplementation(() => ids);
      SelectedGroupStore.add(ids);
      SelectedGroupStore.toggleSelect('14');
      SelectedGroupStore.shiftToggleItems('12');
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([
        ['11', false],
        ['12', true],
        ['13', true],
        ['14', true],
        ['15', false],
      ]);
    });
    it('deslects after selecting', () => {
      const ids = ['11', '12', '13', '14', '15'];
      jest.spyOn(GroupStore, 'getAllItemIds').mockImplementation(() => ids);
      SelectedGroupStore.add(ids);
      SelectedGroupStore.toggleSelect('11');

      // Select everything
      SelectedGroupStore.shiftToggleItems('15');
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([
        ['11', true],
        ['12', true],
        ['13', true],
        ['14', true],
        ['15', true],
      ]);

      // Deslect between 14 and 12
      SelectedGroupStore.toggleSelect('14');
      SelectedGroupStore.shiftToggleItems('12');
      expect([...SelectedGroupStore.getState().records.entries()]).toEqual([
        ['11', true],
        ['12', false],
        ['13', false],
        ['14', false],
        ['15', true],
      ]);
    });
  });

  it('returns a stable reference from getState', () => {
    setRecords({1: true, 2: true});
    const state = SelectedGroupStore.getState();
    expect(Object.is(state, SelectedGroupStore.getState())).toBe(true);
  });
});
