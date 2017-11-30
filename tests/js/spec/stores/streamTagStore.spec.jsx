import StreamTagStore from 'app/stores/streamTagStore';
import MemberListStore from 'app/stores/memberListStore';

describe('StreamTagStore', function() {
  let sandbox;

  beforeEach(() => {
    StreamTagStore.reset();
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('onMemberListStoreChange()', () => {
    it('should map each user\'s username to the "assigned" value array', () => {
      sandbox.stub(MemberListStore, 'getAll').returns([
        {
          username: 'janesmith',
          email: 'janesmith@example.org',
        },
      ]);
      StreamTagStore.onMemberListStoreChange();
      expect(StreamTagStore.tags.assigned.values).toEqual(['me', 'janesmith']);
    });

    it("should fall back to email when username isn't available", () => {
      sandbox.stub(MemberListStore, 'getAll').returns([
        {
          email: 'janesmith@example.org',
        },
      ]);
      StreamTagStore.onMemberListStoreChange();
      expect(StreamTagStore.tags.assigned.values).toEqual([
        'me',
        'janesmith@example.org',
      ]);
    });
  });

  describe('onLoadTagsSuccess()', () => {
    it('should add a new tag with empty values and trigger the new addition', () => {
      sandbox.stub(StreamTagStore, 'trigger');

      StreamTagStore.onLoadTagsSuccess([
        {
          key: 'mytag',
          name: 'My Custom Tag',
        },
      ]);

      expect(StreamTagStore.tags.mytag).toEqual({
        key: 'mytag',
        name: 'My Custom Tag',
        values: [],
      });

      expect(StreamTagStore.trigger.calledOnce).toBeTruthy();
    });

    it('should not overwrite predefined filters', () => {
      let isTag = StreamTagStore.tags.is;
      StreamTagStore.onLoadTagsSuccess([
        {
          key: 'is',
          name: 'Custom Assigned To',
        },
      ]);

      expect(StreamTagStore.tags.is).toEqual(isTag);
    });
  });
});
