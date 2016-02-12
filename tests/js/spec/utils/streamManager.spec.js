const Reflux = require('reflux');
const StreamManager = require('app/utils/streamManager');

describe('StreamManager', function() {

  beforeEach(function() {
    this.store = Reflux.createStore({
      add() {},
      getAllItems() {},
      remove() {}
    });
  });

  it('allows options configuration', function() {
    let options = {limit: 2};
    let mgr = new StreamManager(this.store, options);

    expect(mgr.limit).to.eql(options.limit);
  });

  describe('push()', function() {

    it('allows passing no items', function() {
      let mgr = new StreamManager(this.store);
      expect(mgr.push()).not.to.throw;
      expect(mgr.push([])).not.to.throw;
      expect(mgr.idList.length).to.eql(0);
    });

    it('adds items', function() {
      let storeAdd = sinon.spy(this.store, 'add');
      let mgr = new StreamManager(this.store);
      let items = [{id: 1}];
      mgr.push(items);

      expect(mgr.idList.length).to.eql(1);
      expect(storeAdd.calledWith(items)).to.be.true;
    });

    it('allows adding a single item', function() {
      let storeAdd = sinon.spy(this.store, 'add');
      let mgr = new StreamManager(this.store);
      let item = {id: 1};
      mgr.push(item);

      expect(mgr.idList.length).to.eql(1);
      expect(storeAdd.calledWith([item])).to.be.true;
    });

    it('trims after adding', function() {
      let mgr = new StreamManager(this.store, {limit: 1});
      let storeRemove = sinon.spy(this.store, 'remove');
      let mgrTrim = sinon.spy(mgr, 'trim');
      mgr.push([{id: 1}, {id: 2}]);

      expect(mgr.idList.length).to.eql(1);
      expect(storeRemove.calledWith(2)).to.be.true;
      expect(mgrTrim.called).to.be.true;
    });

    it('preserves NEW order of duplicates', function() {
      let mgr = new StreamManager(this.store);
      mgr.push([{id: 1}, {id: 3}]);
      mgr.push([{id: 1}, {id: 2}]); // New order of "1" if after "3"

      expect(mgr.idList).to.eql([3, 1, 2]);
    });

  });

  describe('trim()', function() {

    it('removes trailing items in excess of the limit', function() {
      let storeRemove = sinon.spy(this.store, 'remove');
      let mgr = new StreamManager(this.store, {limit: 1});
      mgr.idList = [1, 2, 3];
      mgr.trim();

      expect(mgr.idList).to.eql([1]);
      expect(mgr.idList.length).to.eql(1);
      expect(storeRemove.firstCall.calledWith(2)).to.be.true;
      expect(storeRemove.secondCall.calledWith(3)).to.be.true;
    });

    it('does nothing with fewer items than limit', function() {
      let storeRemove = sinon.spy(this.store, 'remove');
      let mgr = new StreamManager(this.store, {limit: 10});
      mgr.idList = [1, 2, 3];
      mgr.trim();

      expect(mgr.idList).to.eql([1, 2, 3]);
      expect(mgr.idList.length).to.eql(3);
      expect(storeRemove.called).to.be.false;
    });

  });

  describe('getAllItems()', function() {

    it('retrives ordered items from store', function() {
      let storeGetAllItems = sinon.stub(this.store, 'getAllItems', function() {
        return [{id: 1}, {id: 2}];
      });
      let mgr = new StreamManager(this.store);
      mgr.push({id: 2});
      mgr.push({id: 1});
      let items = mgr.getAllItems();

      expect(items).to.eql([{id: 2}, {id: 1}]);
      expect(storeGetAllItems.called).to.be.true;
    });

    it('does not mutate store', function() {
      let storeItems = [{id: 1}, {id: 2}];
      sinon.stub(this.store, 'getAllItems', function() {
        return storeItems;
      });
      let mgr = new StreamManager(this.store);
      mgr.push([{id: 2}, {id: 1}]);
      mgr.getAllItems();

      expect(this.store.getAllItems()).to.eql([{id: 1}, {id: 2}]);
    });

  });

  describe('unshift()', function() {

    it('adds items to the start of the list', function() {
      let storeAdd = sinon.spy(this.store, 'add');
      let mgr = new StreamManager(this.store);
      mgr.unshift([{id: 2}]);
      mgr.unshift([{id: 1}]);

      expect(mgr.idList).to.eql([1, 2]);
      expect(storeAdd.firstCall.calledWith([{id: 2}])).to.be.true;
      expect(storeAdd.secondCall.calledWith([{id: 1}])).to.be.true;
    });

    it('moves duplicates to the start of the list', function() {
      let mgr = new StreamManager(this.store);
      mgr.unshift([{id: 2}, {id: 1}]);
      mgr.unshift([{id: 1}]);

      expect(mgr.idList).to.eql([1, 2]);
    });

    it('moves a duplicate array to the start of the list and preserves order', function() {
      let mgr = new StreamManager(this.store);
      mgr.unshift([{id: 3}, {id: 2}, {id: 1}]);
      mgr.unshift([{id: 2}, {id: 1}]);

      expect(mgr.idList).to.eql([2, 1, 3]);
    });

    it('allows adding a single item', function() {
      let mgr = new StreamManager(this.store);
      mgr.unshift({id: 1});

      expect(mgr.idList).to.eql([1]);
    });

  });

});
