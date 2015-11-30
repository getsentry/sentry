const GroupStore = require('app/stores/groupStore');
const SelectedGroupStore = require('app/stores/selectedGroupStore');

describe('SelectedGroupStore', function() {

  beforeEach(function() {
    SelectedGroupStore.records = {};

    this.sandbox = sinon.sandbox.create();
    this.trigger = this.sandbox.spy(SelectedGroupStore, 'trigger');
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('prune()', function() {

    it('removes records no longer in the GroupStore', function() {
      this.sandbox.stub(GroupStore, 'getAllItemIds', () => ['3']);
      SelectedGroupStore.records = {1: true, 2: true, 3: true};
      SelectedGroupStore.prune();
      expect(SelectedGroupStore.records).to.eql({3: true});
    });

    it('doesn\'t have any effect when already in sync', function() {
      this.sandbox.stub(GroupStore, 'getAllItemIds', () => ['1', '2', '3']);
      SelectedGroupStore.records = {1: true, 2: true, 3: true};
      SelectedGroupStore.prune();
      expect(SelectedGroupStore.records).to.eql({1: true, 2: true, 3: true});
    });

  });

  describe('add()', function() {

    it('defaults value of new ids to \'allSelected()\'', function() {
      SelectedGroupStore.records = {1: true};
      SelectedGroupStore.add([2]);
      expect(SelectedGroupStore.records).to.eql({1: true, 2: true});
    });

    it('does not update existing ids', function() {
      SelectedGroupStore.records = {1: false, 2: true};
      SelectedGroupStore.add([3]);
      expect(SelectedGroupStore.records).to.eql({1: false, 2: true, 3: false});
    });

  });

  describe('onGroupChange()', function() {

    beforeEach(function() {
      this.prune = this.sandbox.stub(SelectedGroupStore, 'prune');
      this.add = this.sandbox.stub(SelectedGroupStore, 'add');
    });

    it('adds new ids', function() {
      SelectedGroupStore.onGroupChange([]);
      expect(this.add.called).to.be.true;
    });

    it('prunes stale records', function() {
      SelectedGroupStore.onGroupChange([]);
      expect(this.prune.called).to.be.true;
    });

    it('triggers an update', function() {
      SelectedGroupStore.onGroupChange([]);
      expect(this.trigger.called).to.be.true;
    });

  });

  describe('allSelected()', function() {

    it('returns true when all ids are selected', function() {
      SelectedGroupStore.records = {1: true, 2: true};
      expect(SelectedGroupStore.allSelected()).to.be.true;
    });

    it('returns false when some ids are selected', function() {
      SelectedGroupStore.records = {1: true, 2: false};
      expect(SelectedGroupStore.allSelected()).to.be.false;
    });

    it('returns false when no ids are selected', function() {
      SelectedGroupStore.records = {1: false, 2: false};
      expect(SelectedGroupStore.allSelected()).to.be.false;
    });

    it('returns false when there are no ids', function() {
      expect(SelectedGroupStore.allSelected()).to.be.false;
    });

  });

  describe('anySelected()', function() {

    it('returns true if any ids are selected', function() {
      SelectedGroupStore.records = {1: true, 2: false};
      expect(SelectedGroupStore.anySelected()).to.be.true;
    });

    it('returns false when no ids are selected', function() {
      SelectedGroupStore.records = {1: false, 2: false};
      expect(SelectedGroupStore.anySelected()).to.be.false;
    });

  });

  describe('multiSelected()', function() {

    it('returns true when multiple ids are selected', function() {
      SelectedGroupStore.records = {1: true, 2: true, 3: false};
      expect(SelectedGroupStore.multiSelected()).to.be.true;
    });

    it('returns false when a single id is selected', function() {
      SelectedGroupStore.records = {1: true, 2: false};
      expect(SelectedGroupStore.multiSelected()).to.be.false;
    });

    it('returns false when no ids are selected', function() {
      SelectedGroupStore.records = {1: false, 2: false};
      expect(SelectedGroupStore.multiSelected()).to.be.false;
    });

  });

  describe('getSelectedIds()', function() {

    it('returns selected ids', function() {
      SelectedGroupStore.records = {1: true, 2: false, 3: true};
      let ids = SelectedGroupStore.getSelectedIds();

      expect(ids.has('1')).to.be.true;
      expect(ids.has('3')).to.be.true;
      expect(ids.size).to.eql(2);
    });

    it('returns empty set with no selected ids', function() {
      SelectedGroupStore.records = {1: false};
      let ids = SelectedGroupStore.getSelectedIds();

      expect(ids.has('1')).to.be.false;
      expect(ids.size).to.eql(0);
    });

  });

  describe('isSelected()', function() {

    it('returns true if id is selected', function() {
      SelectedGroupStore.records = {1: true};
      expect(SelectedGroupStore.isSelected(1)).to.be.true;
    });

    it('returns false if id is unselected or unknown', function() {
      SelectedGroupStore.records = {1: false};
      expect(SelectedGroupStore.isSelected(1)).to.be.false;
      expect(SelectedGroupStore.isSelected(2)).to.be.false;
      expect(SelectedGroupStore.isSelected()).to.be.false;
    });

  });

  describe('deselectAll()', function() {

    it('sets all records to false', function() {
      SelectedGroupStore.records = {1: true, 2: true, 3: false};
      SelectedGroupStore.deselectAll();
      expect(SelectedGroupStore.records).to.eql({1: false, 2: false, 3: false});
    });

    it('triggers an update', function() {
      SelectedGroupStore.deselectAll();
      expect(this.trigger.called).to.be.true;
    });

  });

  describe('toggleSelect()', function() {

    it('toggles state given pre-existing id', function() {
      SelectedGroupStore.records = {1: true};
      SelectedGroupStore.toggleSelect(1);
      expect(SelectedGroupStore.records[1]).to.be.false;
    });

    it('does not toggle state given unknown id', function() {
      SelectedGroupStore.toggleSelect(1);
      SelectedGroupStore.toggleSelect();
      SelectedGroupStore.toggleSelect(undefined);
      expect(SelectedGroupStore.records).to.eql({});
    });

    it('triggers an update given pre-existing id', function() {
      SelectedGroupStore.records = {1: true};
      SelectedGroupStore.toggleSelect(1);
      expect(this.trigger.called).to.be.true;
    });

    it('does not trigger an update given unknown id', function() {
      SelectedGroupStore.toggleSelect();
      expect(this.trigger.called).to.be.false;
    });
  });

  describe('toggleSelectAll()', function() {

    it('selects all ids if any are unselected', function() {
      SelectedGroupStore.records = {1: true, 2: false};
      SelectedGroupStore.toggleSelectAll();
      expect(SelectedGroupStore.records).to.eql({1: true, 2: true});
    });

    it('unselects all ids if all are selected', function() {
      SelectedGroupStore.records = {1: true, 2: true};
      SelectedGroupStore.toggleSelectAll();
      expect(SelectedGroupStore.records).to.eql({1: false, 2: false});
    });

    it('triggers an update', function() {
      SelectedGroupStore.toggleSelectAll();
      expect(this.trigger.called).to.be.true;
    });

  });

});
