import {Organization} from 'sentry-fixture/organization';

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

  describe('getIssueAttributes()', function () {
    it('should populate the has tag with values', () => {
      TagStore.loadTagsSuccess([
        {
          key: 'mytag',
          name: 'My Custom Tag',
        },
        {
          key: 'otherkey',
          name: 'My other tag',
        },
      ]);

      expect(TagStore.getIssueAttributes(Organization()).has).toEqual({
        key: 'has',
        name: 'Has Tag',
        values: ['mytag', 'otherkey'],
        predefined: true,
      });
    });

    it('should not overwrite predefined filters', () => {
      TagStore.loadTagsSuccess([
        {
          key: 'is',
          name: 'Custom Assigned To',
        },
      ]);

      const tags = TagStore.getIssueAttributes(Organization());
      expect(tags.is).toBeTruthy();
      expect(tags.is.key).toBe('is');
      expect(tags.assigned).toBeTruthy();
    });

    it('should replace ignore with archive', () => {
      TagStore.loadTagsSuccess([
        {
          key: 'is',
          name: 'Custom Assigned To',
        },
      ]);

      const tags = TagStore.getIssueAttributes(
        Organization({features: ['escalating-issues']})
      );
      expect(tags.is.values).toContain('archived');
      expect(tags.is.values).not.toContain('ignored');
    });
  });

  describe('getIssueTags()', function () {
    it('should have built in, state, and issue attribute tags', () => {
      TagStore.loadTagsSuccess([
        {
          key: 'mytag',
          name: 'My Custom Tag',
        },
      ]);

      const tags = TagStore.getIssueTags(Organization());

      // state
      expect(tags.mytag).toBeTruthy();
      expect(tags.mytag.key).toBe('mytag');

      // attribute
      expect(tags.has).toBeTruthy();
      expect(tags.has.key).toBe('has');

      // built in
      expect(tags['device.family']).toBeTruthy();
      expect(tags['device.family'].key).toBe('device.family');
    });
  });
});
