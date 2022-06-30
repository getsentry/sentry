import {
  addSpace,
  getLastTermIndex,
  getQueryTerms,
  getTagItemsFromKeys,
  removeSpace,
} from 'sentry/components/smartSearchBar/utils';
import {FieldKind} from 'sentry/utils/fields';

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
        predefined: true,
        desc: '',
        values: [],
      },
      device: {
        kind: FieldKind.FIELD,
        key: 'device',
        name: 'Device',
        predefined: true,
        desc: '',
        values: [],
      },
      has: {
        kind: FieldKind.TAG,
        key: 'has',
        name: 'Has',
        predefined: true,
        desc: '',
        values: [],
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
        title: 'has',
        value: 'has:',
        kind: FieldKind.TAG,
        documentation: '-',
      },
    ]);
  });

  it('groups tags', () => {
    const supportedTags = {
      'device.arch': {
        kind: FieldKind.FIELD,
        key: 'device.arch',
        name: 'Device Arch',
        predefined: true,
        desc: '',
        values: [],
      },
      'device.family': {
        kind: FieldKind.FIELD,
        key: 'device.family',
        name: 'Device Family',
        predefined: true,
        desc: '',
        values: [],
      },
      has: {
        kind: FieldKind.TAG,
        key: 'has',
        name: 'Has',
        predefined: true,
        desc: '',
        values: [],
      },
    };
    const tagKeys = Object.keys(supportedTags);

    const items = getTagItemsFromKeys(tagKeys, supportedTags);

    expect(items).toMatchObject([
      {
        title: 'device',
        value: null,
        kind: FieldKind.FIELD,
        documentation: '-',
        children: [
          {
            title: 'device.arch',
            value: 'device.arch:',
            kind: FieldKind.FIELD,
            documentation: '-',
          },
          {
            title: 'device.family',
            value: 'device.family:',
            kind: FieldKind.FIELD,
            documentation: '-',
          },
        ],
      },
      {
        title: 'has',
        value: 'has:',
        kind: FieldKind.TAG,
        documentation: '-',
      },
    ]);
  });

  it('groups tags with single word parent', () => {
    const supportedTags = {
      device: {
        kind: FieldKind.FIELD,
        key: 'device',
        name: 'Device',
        predefined: true,
        desc: '',
        values: [],
      },
      'device.family': {
        kind: FieldKind.FIELD,
        key: 'device.family',
        name: 'Device Family',
        predefined: true,
        desc: '',
        values: [],
      },
      has: {
        kind: FieldKind.TAG,
        key: 'has',
        name: 'Has',
        predefined: true,
        desc: '',
        values: [],
      },
    };
    const tagKeys = Object.keys(supportedTags);

    const items = getTagItemsFromKeys(tagKeys, supportedTags);

    expect(items).toMatchObject([
      {
        title: 'device',
        value: 'device:',
        kind: FieldKind.FIELD,
        documentation: '-',
        children: [
          {
            title: 'device.family',
            value: 'device.family:',
            kind: FieldKind.FIELD,
            documentation: '-',
          },
        ],
      },
      {
        title: 'has',
        value: 'has:',
        kind: FieldKind.TAG,
        documentation: '-',
      },
    ]);
  });
});
