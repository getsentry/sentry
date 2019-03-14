import TagStore from 'app/stores/tagStore';
import MemberListStore from 'app/stores/memberListStore';

describe('TagStore', function() {
  beforeEach(() => {
    TagStore.reset();
  });

  afterEach(() => {});

  describe('onMemberListStoreChange()', () => {
    it('should map each user\'s username to the "assigned" value array', () => {
      jest.spyOn(MemberListStore, 'getAll').mockImplementation(() => [
        {
          username: 'janesmith',
          email: 'janesmith@example.org',
        },
      ]);
      TagStore.onMemberListStoreChange();
      expect(TagStore.tags.assigned.values).toEqual(['me', 'janesmith']);
    });

    it("should fall back to email when username isn't available", () => {
      jest.spyOn(MemberListStore, 'getAll').mockImplementation(() => [
        {
          email: 'janesmith@example.org',
        },
      ]);
      TagStore.onMemberListStoreChange();
      expect(TagStore.tags.assigned.values).toEqual(['me', 'janesmith@example.org']);
    });

    it('should fall back to email when the username is a UUID', () => {
      jest.spyOn(MemberListStore, 'getAll').mockImplementation(() => [
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
      jest.spyOn(TagStore, 'trigger');

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

      expect(TagStore.trigger).toHaveBeenCalledTimes(1);
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
