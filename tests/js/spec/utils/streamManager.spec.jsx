import Reflux from 'reflux';

import StreamManager from 'app/utils/streamManager';

describe('StreamManager', function () {
  let store;

  beforeEach(function () {
    store = Reflux.createStore({
      add() {},
      getAllItems() {},
      remove() {},
    });
  });

  it('allows options configuration', function () {
    const options = {limit: 2};
    const mgr = new StreamManager(store, options);

    expect(mgr.limit).toEqual(options.limit);
  });

  describe('push()', function () {
    it('allows passing no items', function () {
      const mgr = new StreamManager(store);
      expect(() => mgr.push()).not.toThrow();
      expect(() => mgr.push([])).not.toThrow();
      expect(mgr.idList).toHaveLength(0);
    });

    it('adds items', function () {
      const storeAdd = jest.spyOn(store, 'add');
      const mgr = new StreamManager(store);
      const items = [{id: 1}];
      mgr.push(items);

      expect(mgr.idList).toHaveLength(1);
      expect(storeAdd).toHaveBeenCalledWith(items);
    });

    it('allows adding a single item', function () {
      const storeAdd = jest.spyOn(store, 'add');
      const mgr = new StreamManager(store);
      const item = {id: 1};
      mgr.push(item);

      expect(mgr.idList).toHaveLength(1);
      expect(storeAdd).toHaveBeenCalledWith([item]);
    });

    it('trims after adding', function () {
      const mgr = new StreamManager(store, {limit: 1});
      const storeRemove = jest.spyOn(store, 'remove');
      const mgrTrim = jest.spyOn(mgr, 'trim');
      mgr.push([{id: 1}, {id: 2}]);

      expect(mgr.idList).toHaveLength(1);
      expect(storeRemove).toHaveBeenCalledWith(2, expect.anything(), expect.anything());
      expect(mgrTrim).toHaveBeenCalled();
    });

    it('preserves NEW order of duplicates', function () {
      const mgr = new StreamManager(store);
      mgr.push([{id: 1}, {id: 3}]);
      mgr.push([{id: 1}, {id: 2}]); // New order of "1" if after "3"

      expect(mgr.idList).toEqual([3, 1, 2]);
    });
  });

  describe('trim()', function () {
    it('removes trailing items in excess of the limit', function () {
      const storeRemove = jest.spyOn(store, 'remove');
      const mgr = new StreamManager(store, {limit: 1});
      mgr.idList = [1, 2, 3];
      mgr.trim();

      expect(mgr.idList).toEqual([1]);
      expect(mgr.idList).toHaveLength(1);
      expect(storeRemove.mock.calls[0][0]).toEqual(2);
      expect(storeRemove.mock.calls[1][0]).toEqual(3);
    });

    it('does nothing with fewer items than limit', function () {
      const storeRemove = jest.spyOn(store, 'remove');
      const mgr = new StreamManager(store, {limit: 10});
      mgr.idList = [1, 2, 3];
      mgr.trim();

      expect(mgr.idList).toEqual([1, 2, 3]);
      expect(mgr.idList).toHaveLength(3);
      expect(storeRemove).not.toHaveBeenCalled();
    });
  });

  describe('getAllItems()', function () {
    it('retrives ordered items from store', function () {
      const storeGetAllItems = jest
        .spyOn(store, 'getAllItems')
        .mockImplementation(() => [{id: 1}, {id: 2}]);
      const mgr = new StreamManager(store);
      mgr.push({id: 2});
      mgr.push({id: 1});
      const items = mgr.getAllItems();

      expect(items).toEqual([{id: 2}, {id: 1}]);
      expect(storeGetAllItems).toHaveBeenCalled();
    });

    it('does not mutate store', function () {
      const storeItems = [{id: 1}, {id: 2}];
      jest.spyOn(store, 'getAllItems').mockImplementation(() => storeItems);
      const mgr = new StreamManager(store);
      mgr.push([{id: 2}, {id: 1}]);
      mgr.getAllItems();

      expect(store.getAllItems()).toEqual([{id: 1}, {id: 2}]);
    });
  });

  describe('unshift()', function () {
    it('adds items to the start of the list', function () {
      const storeAdd = jest.spyOn(store, 'add');
      const mgr = new StreamManager(store);
      mgr.unshift([{id: 2}]);
      mgr.unshift([{id: 1}]);

      expect(mgr.idList).toEqual([1, 2]);
      expect(storeAdd.mock.calls[0][0]).toEqual([{id: 2}]);
      expect(storeAdd.mock.calls[1][0]).toEqual([{id: 1}]);
    });

    it('moves duplicates to the start of the list', function () {
      const mgr = new StreamManager(store);
      mgr.unshift([{id: 2}, {id: 1}]);
      mgr.unshift([{id: 1}]);

      expect(mgr.idList).toEqual([1, 2]);
    });

    it('moves a duplicate array to the start of the list and preserves order', function () {
      const mgr = new StreamManager(store);
      mgr.unshift([{id: 3}, {id: 2}, {id: 1}]);
      mgr.unshift([{id: 2}, {id: 1}]);

      expect(mgr.idList).toEqual([2, 1, 3]);
    });

    it('allows adding a single item', function () {
      const mgr = new StreamManager(store);
      mgr.unshift({id: 1});

      expect(mgr.idList).toEqual([1]);
    });
  });
});
