import GroupStore from 'app/stores/groupStore';

describe('GroupStore', function () {
  beforeEach(function () {
    GroupStore.reset();
  });

  describe('onMergeSuccess()', function () {
    it('should remove the non-parent merged ids', function () {
      GroupStore.items = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 }
      ];

      GroupStore.onMergeSuccess(null,
        [2, 3, 4], // items merged
        { merge: { parent: 3 } } // merge API response
      );

      expect(GroupStore.items).to.eql([
        { id: 1 },
        { id: 3 } // parent
      ]);
    });
  });
});
