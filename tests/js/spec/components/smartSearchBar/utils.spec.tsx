import {
  addSpace,
  filterKeysFromQuery,
  getLastTermIndex,
  getQueryTerms,
  getTagItemsFromKeys,
  removeSpace,
} from 'sentry/components/smartSearchBar/utils';
import * as Fields from 'sentry/utils/fields';

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
        kind: Fields.FieldKind.FIELD,
        key: 'browser',
        name: 'Browser',
      },
      device: {
        kind: Fields.FieldKind.FIELD,
        key: 'device',
        name: 'Device',
      },
      someTag: {
        kind: Fields.FieldKind.TAG,
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
        kind: Fields.FieldKind.FIELD,
        documentation: '-',
      },
      {
        title: 'device',
        value: 'device:',
        kind: Fields.FieldKind.FIELD,
        documentation: '-',
      },
      {
        title: 'someTag',
        value: 'someTag:',
        kind: Fields.FieldKind.TAG,
        documentation: '-',
      },
    ]);
  });

  it('groups tags', () => {
    const supportedTags = {
      'tag1.arch': {
        key: 'tag1.arch',
        name: 'Tag1 Arch',
        kind: Fields.FieldKind.FIELD,
      },
      'tag1.family': {
        key: 'tag1.family',
        name: 'Tag1 Family',
        kind: Fields.FieldKind.FIELD,
      },
      test: {
        key: 'test',
        name: 'Test',
        kind: Fields.FieldKind.TAG,
      },
    };
    const tagKeys = Object.keys(supportedTags);

    const items = getTagItemsFromKeys(tagKeys, supportedTags);

    expect(items).toMatchObject([
      {
        title: 'tag1',
        value: null,
        kind: Fields.FieldKind.FIELD,
        documentation: '-',
        children: [
          {
            title: 'tag1.arch',
            value: 'tag1.arch:',
            kind: Fields.FieldKind.FIELD,
            documentation: '-',
          },
          {
            title: 'tag1.family',
            value: 'tag1.family:',
            kind: Fields.FieldKind.FIELD,
            documentation: '-',
          },
        ],
      },
      {
        title: 'test',
        value: 'test:',
        kind: Fields.FieldKind.TAG,
        documentation: '-',
      },
    ]);
  });

  it('groups tags with single word parent', () => {
    const supportedTags = {
      tag1: {
        kind: Fields.FieldKind.FIELD,
        key: 'tag1',
        name: 'Tag1',
      },
      'tag1.family': {
        kind: Fields.FieldKind.FIELD,
        key: 'tag1.family',
        name: 'Tag1 Family',
      },
      test: {
        kind: Fields.FieldKind.TAG,
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
        kind: Fields.FieldKind.FIELD,
        documentation: '-',
        children: [
          {
            title: 'tag1.family',
            value: 'tag1.family:',
            kind: Fields.FieldKind.FIELD,
            documentation: '-',
          },
        ],
      },
      {
        title: 'test',
        value: 'test:',
        kind: Fields.FieldKind.TAG,
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
        kind: Fields.getFieldDefinition('device.family')?.kind,
        documentation: Fields.getFieldDefinition('device.family')?.desc,
      },
      {
        title: 'has',
        value: 'has:',
        kind: Fields.getFieldDefinition('has')?.kind,
        documentation: Fields.getFieldDefinition('has')?.desc,
      },
    ]);
  });
});

describe('filterKeysFromQuery', () => {
  let spy: jest.SpyInstance | undefined;
  beforeAll(() => {
    spy = jest.spyOn(Fields, 'getFieldDefinition').mockImplementation((key: string) => {
      const map = {
        has: {
          desc: 'Has lol',
        },
        aa: {
          desc: 'this has the word in it',
        },
        bb: {
          desc: 'this does not have the word in it',
          keywords: ['cc'],
        },
      };

      return map[key];
    });
  });

  afterAll(() => {
    spy?.mockRestore();
  });

  it('filters', () => {
    expect(filterKeysFromQuery(['has', 'aa', 'bb'], 'has')).toMatchObject(['has', 'aa']);
  });

  it('filters via description only', () => {
    expect(filterKeysFromQuery(['has', 'aa', 'bb'], 'word')).toMatchObject(['aa', 'bb']);
  });

  it('filters via key only', () => {
    expect(filterKeysFromQuery(['has', 'aa', 'bb'], 'aa')).toMatchObject(['aa']);
  });
  it('filters via keywords', () => {
    expect(filterKeysFromQuery(['has', 'aa', 'bb'], 'cc')).toMatchObject(['bb']);
  });
});
