import StreamTagStore from "app/stores/streamTagStore";

describe("StreamTagStore", function () {
  beforeEach(() => {
    StreamTagStore.reset();
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    this.sandbox.restore();
  });

  describe("onLoadTagsSuccess()", () => {

    it("should add a new tag with empty values and trigger the new addition", () => {
      this.sandbox.stub(StreamTagStore, 'trigger');

      StreamTagStore.onLoadTagsSuccess([{
        key: 'mytag',
        name: 'My Custom Tag'
      }]);

      expect(StreamTagStore.tags.mytag).to.eql({
        key: 'mytag',
        name: 'My Custom Tag',
        values: []
      });

      expect(StreamTagStore.trigger.calledOnce).to.be.ok;
    });

    it("should not overwrite predefined filters", () => {
      let isTag = StreamTagStore.tags.is;
      StreamTagStore.onLoadTagsSuccess([{
        key: 'is',
        name: 'Custom Assigned To'
      }]);

      expect(StreamTagStore.tags.is).to.equal(isTag);
    });
  });
});