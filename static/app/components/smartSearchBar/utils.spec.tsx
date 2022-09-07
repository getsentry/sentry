import {
  addSpace,
  filterKeysFromQuery,
  getLastTermIndex,
  getQueryTerms,
  getTagItemsFromKeys,
  removeSpace,
} from 'sentry/components/smartSearchBar/utils';
import {FieldKey, FieldKind, getFieldDefinition} from 'sentry/utils/fields';

describe('addSpace()', function () {
  it('should add a space when there is no trailing space', function () {
    expect(addSpace('one')).toEqual('one ');
  });

  it('should not add another space when there is already one', function () {
    expect(addSpace('one ')).toEqual('one ');
  });

  it('should leave the empty string alone', function () {
    expect(addSpace('')).toEqual('');
  });
});

describe('removeSpace()', function () {
  it('should remove a trailing space', function () {
    expect(removeSpace('one ')).toEqual('one');
  });

  it('should not remove the last character if it is not a space', function () {
    expect(removeSpace('one')).toEqual('one');
  });

  it('should leave the empty string alone', function () {
    expect(removeSpace('')).toEqual('');
  });
});

describe('getQueryTerms()', function () {
  it('should extract query terms from a query string', function () {
    let query = 'tagname: ';
    expect(getQueryTerms(query, query.length)).toEqual(['tagname:']);

    query = 'tagname:derp browser:';
    expect(getQueryTerms(query, query.length)).toEqual(['tagname:derp', 'browser:']);

    query = '   browser:"Chrome 33.0"    ';
    expect(getQueryTerms(query, query.length)).toEqual(['browser:"Chrome 33.0"']);
  });
});

describe('getLastTermIndex()', function () {
  it('should provide the index of the last query term, given cursor index', function () {
    let query = 'tagname:';
    expect(getLastTermIndex(query, 0)).toEqual(8);

    query = 'tagname:foo'; // 'f' (index 9)
    expect(getLastTermIndex(query, 9)).toEqual(11);

    query = 'tagname:foo anothertag:bar'; // 'f' (index 9)
    expect(getLastTermIndex(query, 9)).toEqual(11);
  });
});

describe('getTagItemsFromKeys()', function () {
  it('gets items from tags', () => {
    const supportedTags = {
      browser: {
        kind: FieldKind.FIELD,
        key: 'browser',
        name: 'Browser',
      },
      device: {
        kind: FieldKind.FIELD,
        key: 'device',
        name: 'Device',
      },
      someTag: {
        kind: FieldKind.TAG,
        key: 'someTag',
        name: 'someTag',
      },
    };
    const tagKeys = Object.keys(supportedTags);

    const items = getTagItemsFromKeys(tagKeys, supportedTags);

    expect(items).toMatchObject([
      {
        title: 'browser',
        value: 'browser:',
        kind: FieldKind.FIELD,
        documentation: '-',
      },
      {
        title: 'device',
        value: 'device:',
        kind: FieldKind.FIELD,
        documentation: '-',
      },
      {
        title: 'someTag',
        value: 'someTag:',
        kind: FieldKind.TAG,
        documentation: '-',
      },
    ]);
  });

  it('groups tags', () => {
    const supportedTags = {
      'tag1.arch': {
        key: 'tag1.arch',
        name: 'Tag1 Arch',
        kind: FieldKind.FIELD,
      },
      'tag1.family': {
        key: 'tag1.family',
        name: 'Tag1 Family',
        kind: FieldKind.FIELD,
      },
      test: {
        key: 'test',
        name: 'Test',
        kind: FieldKind.TAG,
      },
    };
    const tagKeys = Object.keys(supportedTags);

    const items = getTagItemsFromKeys(tagKeys, supportedTags);

    expect(items).toMatchObject([
      {
        title: 'tag1',
        value: null,
        kind: FieldKind.FIELD,
        documentation: '-',
        children: [
          {
            title: 'tag1.arch',
            value: 'tag1.arch:',
            kind: FieldKind.FIELD,
            documentation: '-',
          },
          {
            title: 'tag1.family',
            value: 'tag1.family:',
            kind: FieldKind.FIELD,
            documentation: '-',
          },
        ],
      },
      {
        title: 'test',
        value: 'test:',
        kind: FieldKind.TAG,
        documentation: '-',
      },
    ]);
  });

  it('groups tags with single word parent', () => {
    const supportedTags = {
      tag1: {
        kind: FieldKind.FIELD,
        key: 'tag1',
        name: 'Tag1',
      },
      'tag1.family': {
        kind: FieldKind.FIELD,
        key: 'tag1.family',
        name: 'Tag1 Family',
      },
      test: {
        kind: FieldKind.TAG,
        key: 'test',
        name: 'Test',
      },
    };
    const tagKeys = Object.keys(supportedTags);

    const items = getTagItemsFromKeys(tagKeys, supportedTags);

    expect(items).toMatchObject([
      {
        title: 'tag1',
        value: 'tag1:',
        kind: FieldKind.FIELD,
        documentation: '-',
        children: [
          {
            title: 'tag1.family',
            value: 'tag1.family:',
            kind: FieldKind.FIELD,
            documentation: '-',
          },
        ],
      },
      {
        title: 'test',
        value: 'test:',
        kind: FieldKind.TAG,
        documentation: '-',
      },
    ]);
  });

  it('uses field definitions', () => {
    const supportedTags = {
      has: {
        key: 'has',
        name: 'Has',
      },
      'device.family': {
        key: 'device.family',
        name: 'Device Family',
      },
    };
    const tagKeys = Object.keys(supportedTags).sort((a, b) => a.localeCompare(b));

    const items = getTagItemsFromKeys(tagKeys, supportedTags);

    expect(items).toMatchObject([
      {
        title: 'device.family',
        value: 'device.family:',
        kind: getFieldDefinition('device.family')?.kind,
        documentation: getFieldDefinition('device.family')?.desc,
      },
      {
        title: 'has',
        value: 'has:',
        kind: getFieldDefinition('has')?.kind,
        documentation: getFieldDefinition('has')?.desc,
      },
    ]);
  });
});

describe('filterKeysFromQuery', () => {
  it('filters', () => {
    expect(
      filterKeysFromQuery(
        [FieldKey.DEVICE_ARCH, FieldKey.DEVICE_CHARGING, FieldKey.EVENT_TYPE],
        'event'
      )
    ).toMatchObject([FieldKey.EVENT_TYPE, FieldKey.DEVICE_CHARGING]);
  });

  it('filters via description only', () => {
    expect(
      filterKeysFromQuery(
        [FieldKey.DEVICE_ARCH, FieldKey.DEVICE_CHARGING, FieldKey.EVENT_TYPE],
        'time'
      )
    ).toMatchObject([FieldKey.DEVICE_CHARGING]);
  });

  it('filters via key only', () => {
    expect(
      filterKeysFromQuery(
        [FieldKey.DEVICE_ARCH, FieldKey.DEVICE_CHARGING, FieldKey.EVENT_TYPE],
        'device'
      )
    ).toMatchObject([FieldKey.DEVICE_ARCH, FieldKey.DEVICE_CHARGING]);
  });

  it('filters via keywords', () => {
    expect(
      filterKeysFromQuery(
        [FieldKey.IS, FieldKey.DEVICE_CHARGING, FieldKey.EVENT_TYPE],
        'unresolved'
      )
    ).toMatchObject([FieldKey.IS]);
  });
});
