import TagStore from 'sentry/stores/tagStore';

describe('TagStore', function () {
  beforeEach(() => {
    TagStore.reset();
  });

  afterEach(() => {});

  describe('loadTagsSuccess()', () => {
    it('should add a new tag with empty values and trigger the new addition', () => {
      jest.spyOn(TagStore, 'trigger');

      TagStore.loadTagsSuccess([
        {
          key: 'mytag',
          name: 'My Custom Tag',
        },
        {key: 'other', name: 'Other'},
      ]);

      const tags = TagStore.getState();
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

  it('returns a stable reference from getState', () => {
    TagStore.loadTagsSuccess([
      {
        key: 'mytag',
        name: 'My Custom Tag',
      },
    ]);
    const state = TagStore.getState();
    expect(Object.is(state, TagStore.getState())).toBe(true);
  });
});
