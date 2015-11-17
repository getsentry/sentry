import GroupStore from 'app/stores/groupStore';

describe('GroupStore', function () {
  beforeEach(function () {
    GroupStore.reset();
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
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

  describe('onUpdate()', function () {
    it('should treat undefined itemIds argument as \'all\'', function () {
      GroupStore.items = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ];

      this.sandbox.stub(GroupStore, 'trigger');
      GroupStore.onUpdate(1337, undefined, 'somedata');


      expect(GroupStore.trigger.calledOnce).to.be.ok;
      expect(GroupStore.trigger.firstCall.args[0]).to.eql(new Set([1,2,3]));
    });
  });

  describe('onUpdateSuccess()', function () {
    it('should treat undefined itemIds argument as \'all\'', function () {
      GroupStore.items = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ];

      this.sandbox.stub(GroupStore, 'trigger');
      GroupStore.onUpdateSuccess(1337, undefined, 'somedata');

      expect(GroupStore.trigger.calledOnce).to.be.ok;
      expect(GroupStore.trigger.firstCall.args[0]).to.eql(new Set([1,2,3]));
    });
  });
});

