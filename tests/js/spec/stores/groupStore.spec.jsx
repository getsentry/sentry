import GroupStore from 'app/stores/groupStore';

describe('GroupStore', function() {
  let sandbox;

  beforeEach(function() {
    GroupStore.reset();
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('add()', function() {
    it('should add new entries', function() {
      GroupStore.items = [];
      GroupStore.add([{id: 1}, {id: 2}]);

      expect(GroupStore.items).toEqual([{id: 1}, {id: 2}]);
    });

    it('should update matching existing entries', function() {
      GroupStore.items = [{id: 1}, {id: 2}];

      GroupStore.add([{id: 1, foo: 'bar'}, {id: 3}]);

      expect(GroupStore.items).toEqual([{id: 1, foo: 'bar'}, {id: 2}, {id: 3}]);
    });
  });

  describe('onMergeSuccess()', function() {
    it('should remove the non-parent merged ids', function() {
      GroupStore.items = [{id: 1}, {id: 2}, {id: 3}, {id: 4}];

      GroupStore.onMergeSuccess(
        null,
        [2, 3, 4], // items merged
        {merge: {parent: 3}} // merge API response
      );

      expect(GroupStore.items).toEqual([
        {id: 1},
        {id: 3}, // parent
      ]);
    });
  });

  describe('update methods', function() {
    beforeEach(function() {
      GroupStore.reset();
      GroupStore.items = [{id: 1}, {id: 2}, {id: 3}];
    });

    describe('onUpdate()', function() {
      it("should treat undefined itemIds argument as 'all'", function() {
        sandbox.stub(GroupStore, 'trigger');
        GroupStore.onUpdate(1337, undefined, 'somedata');

        expect(GroupStore.trigger.calledOnce).toBeTruthy();
        expect(GroupStore.trigger.firstCall.args[0]).toEqual(new Set([1, 2, 3]));
      });
    });

    describe('onUpdateSuccess()', function() {
      it("should treat undefined itemIds argument as 'all'", function() {
        sandbox.stub(GroupStore, 'trigger');
        GroupStore.onUpdateSuccess(1337, undefined, 'somedata');

        expect(GroupStore.trigger.calledOnce).toBeTruthy();
        expect(GroupStore.trigger.firstCall.args[0]).toEqual(new Set([1, 2, 3]));
      });
    });

    describe('onUpdateError()', function() {
      it("should treat undefined itemIds argument as 'all'", function() {
        sandbox.stub(GroupStore, 'trigger');
        GroupStore.onUpdateError(1337, undefined, 'something failed', false);

        expect(GroupStore.trigger.calledOnce).toBeTruthy();
        expect(GroupStore.trigger.firstCall.args[0]).toEqual(new Set([1, 2, 3]));
      });
    });

    describe('onDeleteSuccess()', function() {
      it("should treat undefined itemIds argument as 'all'", function() {
        sandbox.stub(GroupStore, 'trigger');
        GroupStore.onDeleteSuccess(1337, undefined, 'somedata');

        expect(GroupStore.trigger.calledOnce).toBeTruthy();
        expect(GroupStore.trigger.firstCall.args[0]).toEqual(new Set([1, 2, 3]));
      });
    });
  });
});
