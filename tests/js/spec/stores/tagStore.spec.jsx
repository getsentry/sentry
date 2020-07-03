import TagStore from 'app/stores/tagStore';

describe('TagStore', function() {
  beforeEach(() => {
    TagStore.reset();
  });

  afterEach(() => {});

  describe('onLoadTagsSuccess()', () => {
    it('should add a new tag with empty values and trigger the new addition', () => {
      jest.spyOn(TagStore, 'trigger');

      TagStore.onLoadTagsSuccess([
        {
          key: 'mytag',
          name: 'My Custom Tag',
        },
        {key: 'other', name: 'Other'},
      ]);

      const tags = TagStore.getAllTags();
      expect(tags.mytag).toEqual({
        key: 'mytag',
        name: 'My Custom Tag',
        values: [],
      });
      expect(tags.other).toEqual({
        key: 'other',
        name: 'Other',
        values: [],
      });

      expect(TagStore.trigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('getIssueAttributes()', function() {
    it('should populate the has tag with values', () => {
      TagStore.onLoadTagsSuccess([
        {
          key: 'mytag',
          name: 'My Custom Tag',
        },
        {
          key: 'otherkey',
          name: 'My other tag',
        },
      ]);

      expect(TagStore.getIssueAttributes().has).toEqual({
        key: 'has',
        name: 'Has Tag',
        values: ['mytag', 'otherkey'],
        predefined: true,
      });
    });

    it('should not overwrite predefined filters', () => {
      TagStore.onLoadTagsSuccess([
        {
          key: 'is',
          name: 'Custom Assigned To',
        },
      ]);

      const tags = TagStore.getIssueAttributes();
      expect(tags.is).toBeTruthy();
      expect(tags.is.key).toBe('is');
      expect(tags.assigned).toBeTruthy();
    });
  });

  describe('getBuiltInTags()', function() {
    it('should be a map of built in properties', () => {
      const tags = TagStore.getBuiltInTags();
      expect(tags.location).toEqual({
        key: 'location',
        name: 'location',
      });
      expect(tags.id).toBeUndefined();
    });
  });
});
