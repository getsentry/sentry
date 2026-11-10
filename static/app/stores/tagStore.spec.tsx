import {TagStore} from './tagStore';

describe('TagStore', () => {
  beforeEach(() => {
    TagStore.reset();
  });

  describe('loadTagsSuccess()', () => {
    it('should add a new tag with empty values and notify subscribers', () => {
      const listener = jest.fn();
      const unsubscribe = TagStore.subscribe(listener);

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

      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('carries over previously loaded tags and prefers the newer tag', () => {
      TagStore.loadTagsSuccess([
        {key: 'browser', name: 'Browser'},
        {key: 'device', name: 'Old Device'},
      ]);
      TagStore.loadTagsSuccess([
        {key: 'device', name: 'New Device'},
        {key: 'os', name: 'OS'},
      ]);

      expect(TagStore.getState()).toEqual({
        browser: {key: 'browser', name: 'Browser', values: []},
        device: {key: 'device', name: 'New Device', values: []},
        os: {key: 'os', name: 'OS', values: []},
      });
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
