import GroupStore from 'app/stores/groupStore';

describe('GroupStore', function () {
  beforeEach(function () {
    GroupStore.reset();
  });

  describe('add()', function () {
    it('should add new entries', function () {
      GroupStore.items = [];
      GroupStore.add([{id: 1}, {id: 2}]);

      expect(GroupStore.items).toEqual([{id: 1}, {id: 2}]);
    });

    it('should update matching existing entries', function () {
      GroupStore.items = [{id: 1}, {id: 2}];

      GroupStore.add([{id: 1, foo: 'bar'}, {id: 3}]);

      expect(GroupStore.items).toEqual([{id: 1, foo: 'bar'}, {id: 2}, {id: 3}]);
    });
  });

  describe('onMergeSuccess()', function () {
    it('should remove the non-parent merged ids', function () {
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

  describe('update methods', function () {
    beforeAll(function () {
      jest.spyOn(GroupStore, 'trigger');
    });
    beforeEach(function () {
      GroupStore.trigger.mockReset();
    });

    beforeEach(function () {
      GroupStore.items = [{id: 1}, {id: 2}, {id: 3}];
    });

    describe('onUpdate()', function () {
      it("should treat undefined itemIds argument as 'all'", function () {
        GroupStore.onUpdate(1337, undefined, 'somedata');

        expect(GroupStore.trigger).toHaveBeenCalledTimes(1);
        expect(GroupStore.trigger).toHaveBeenCalledWith(new Set([1, 2, 3]));
      });
    });

    describe('onUpdateSuccess()', function () {
      it("should treat undefined itemIds argument as 'all'", function () {
        GroupStore.onUpdateSuccess(1337, undefined, 'somedata');

        expect(GroupStore.trigger).toHaveBeenCalledTimes(1);
        expect(GroupStore.trigger).toHaveBeenCalledWith(new Set([1, 2, 3]));
      });
    });

    describe('onUpdateError()', function () {
      it("should treat undefined itemIds argument as 'all'", function () {
        GroupStore.onUpdateError(1337, undefined, 'something failed', false);

        expect(GroupStore.trigger).toHaveBeenCalledTimes(1);
        expect(GroupStore.trigger).toHaveBeenCalledWith(new Set([1, 2, 3]));
      });
    });

    describe('onDeleteSuccess()', function () {
      it("should treat undefined itemIds argument as 'all'", function () {
        GroupStore.onDeleteSuccess(1337, undefined, 'somedata');

        expect(GroupStore.trigger).toHaveBeenCalledTimes(1);
        expect(GroupStore.trigger).toHaveBeenCalledWith(new Set([1, 2, 3]));
      });
    });
  });
});
