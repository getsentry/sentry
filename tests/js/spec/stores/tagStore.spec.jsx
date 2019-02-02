import TagStore from 'app/stores/tagStore';
import MemberListStore from 'app/stores/memberListStore';

describe('TagStore', function() {
  let sandbox;

  beforeEach(() => {
    TagStore.reset();
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
      TagStore.onMemberListStoreChange();
      expect(TagStore.tags.assigned.values).toEqual(['me', 'janesmith']);
    });

    it("should fall back to email when username isn't available", () => {
      sandbox.stub(MemberListStore, 'getAll').returns([
        {
          email: 'janesmith@example.org',
        },
      ]);
      TagStore.onMemberListStoreChange();
      expect(TagStore.tags.assigned.values).toEqual(['me', 'janesmith@example.org']);
    });

    it('should fall back to email when the username is a UUID', () => {
      sandbox.stub(MemberListStore, 'getAll').returns([
        {
          username: '8f5c6478172d4389930c12841f45dc18',
          email: 'janesmith@example.org',
        },
      ]);
      TagStore.onMemberListStoreChange();
      expect(TagStore.tags.assigned.values).toEqual(['me', 'janesmith@example.org']);
    });
  });

  describe('onLoadTagsSuccess()', () => {
    it('should add a new tag with empty values and trigger the new addition', () => {
      sandbox.stub(TagStore, 'trigger');

      TagStore.onLoadTagsSuccess([
        {
          key: 'mytag',
          name: 'My Custom Tag',
        },
      ]);

      expect(TagStore.tags.mytag).toEqual({
        key: 'mytag',
        name: 'My Custom Tag',
        values: [],
      });

      expect(TagStore.trigger.calledOnce).toBeTruthy();
    });

    it('should not overwrite predefined filters', () => {
      const isTag = TagStore.tags.is;
      TagStore.onLoadTagsSuccess([
        {
          key: 'is',
          name: 'Custom Assigned To',
        },
      ]);

      expect(TagStore.tags.is).toEqual(isTag);
    });
  });
});
