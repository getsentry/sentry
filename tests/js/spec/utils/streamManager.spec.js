import Reflux from 'reflux';
import StreamManager from 'app/utils/streamManager';

describe('StreamManager', function() {
  let store;

  beforeEach(function() {
    store = Reflux.createStore({
      add() {},
      getAllItems() {},
      remove() {},
    });
  });

  it('allows options configuration', function() {
    let options = {limit: 2};
    let mgr = new StreamManager(store, options);

    expect(mgr.limit).toEqual(options.limit);
  });

  describe('push()', function() {
    it('allows passing no items', function() {
      let mgr = new StreamManager(store);
      expect(() => mgr.push()).not.toThrow();
      expect(() => mgr.push([])).not.toThrow();
      expect(mgr.idList).toHaveLength(0);
    });

    it('adds items', function() {
      let storeAdd = sinon.spy(store, 'add');
      let mgr = new StreamManager(store);
      let items = [{id: 1}];
      mgr.push(items);

      expect(mgr.idList).toHaveLength(1);
      expect(storeAdd.calledWith(items)).toBe(true);
    });

    it('allows adding a single item', function() {
      let storeAdd = sinon.spy(store, 'add');
      let mgr = new StreamManager(store);
      let item = {id: 1};
      mgr.push(item);

      expect(mgr.idList).toHaveLength(1);
      expect(storeAdd.calledWith([item])).toBe(true);
    });

    it('trims after adding', function() {
      let mgr = new StreamManager(store, {limit: 1});
      let storeRemove = sinon.spy(store, 'remove');
      let mgrTrim = sinon.spy(mgr, 'trim');
      mgr.push([{id: 1}, {id: 2}]);

      expect(mgr.idList).toHaveLength(1);
      expect(storeRemove.calledWith(2)).toBe(true);
      expect(mgrTrim.called).toBe(true);
    });

    it('preserves NEW order of duplicates', function() {
      let mgr = new StreamManager(store);
      mgr.push([{id: 1}, {id: 3}]);
      mgr.push([{id: 1}, {id: 2}]); // New order of "1" if after "3"

      expect(mgr.idList).toEqual([3, 1, 2]);
    });
  });

  describe('trim()', function() {
    it('removes trailing items in excess of the limit', function() {
      let storeRemove = sinon.spy(store, 'remove');
      let mgr = new StreamManager(store, {limit: 1});
      mgr.idList = [1, 2, 3];
      mgr.trim();

      expect(mgr.idList).toEqual([1]);
      expect(mgr.idList).toHaveLength(1);
      expect(storeRemove.firstCall.calledWith(2)).toBe(true);
      expect(storeRemove.secondCall.calledWith(3)).toBe(true);
    });

    it('does nothing with fewer items than limit', function() {
      let storeRemove = sinon.spy(store, 'remove');
      let mgr = new StreamManager(store, {limit: 10});
      mgr.idList = [1, 2, 3];
      mgr.trim();

      expect(mgr.idList).toEqual([1, 2, 3]);
      expect(mgr.idList).toHaveLength(3);
      expect(storeRemove.called).toBe(false);
    });
  });

  describe('getAllItems()', function() {
    it('retrives ordered items from store', function() {
      let storeGetAllItems = sinon.stub(store, 'getAllItems', function() {
        return [{id: 1}, {id: 2}];
      });
      let mgr = new StreamManager(store);
      mgr.push({id: 2});
      mgr.push({id: 1});
      let items = mgr.getAllItems();

      expect(items).toEqual([{id: 2}, {id: 1}]);
      expect(storeGetAllItems.called).toBe(true);
    });

    it('does not mutate store', function() {
      let storeItems = [{id: 1}, {id: 2}];
      sinon.stub(store, 'getAllItems', function() {
        return storeItems;
      });
      let mgr = new StreamManager(store);
      mgr.push([{id: 2}, {id: 1}]);
      mgr.getAllItems();

      expect(store.getAllItems()).toEqual([{id: 1}, {id: 2}]);
    });
  });

  describe('unshift()', function() {
    it('adds items to the start of the list', function() {
      let storeAdd = sinon.spy(store, 'add');
      let mgr = new StreamManager(store);
      mgr.unshift([{id: 2}]);
      mgr.unshift([{id: 1}]);

      expect(mgr.idList).toEqual([1, 2]);
      expect(storeAdd.firstCall.calledWith([{id: 2}])).toBe(true);
      expect(storeAdd.secondCall.calledWith([{id: 1}])).toBe(true);
    });

    it('moves duplicates to the start of the list', function() {
      let mgr = new StreamManager(store);
      mgr.unshift([{id: 2}, {id: 1}]);
      mgr.unshift([{id: 1}]);

      expect(mgr.idList).toEqual([1, 2]);
    });

    it('moves a duplicate array to the start of the list and preserves order', function() {
      let mgr = new StreamManager(store);
      mgr.unshift([{id: 3}, {id: 2}, {id: 1}]);
      mgr.unshift([{id: 2}, {id: 1}]);

      expect(mgr.idList).toEqual([2, 1, 3]);
    });

    it('allows adding a single item', function() {
      let mgr = new StreamManager(store);
      mgr.unshift({id: 1});

      expect(mgr.idList).toEqual([1]);
    });
  });
});
