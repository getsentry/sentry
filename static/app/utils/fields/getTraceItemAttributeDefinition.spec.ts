import {FieldValueType} from 'sentry/utils/fields';
import {
  getTraceItemAttributeDefinition,
  parseTypedTagKey,
} from 'sentry/utils/fields/getTraceItemAttributeDefinition';

describe('parseTypedTagKey', () => {
  it('splits a typed tag key into its name and type', () => {
    expect(parseTypedTagKey('tags[code.line.number,number]')).toEqual({
      name: 'code.line.number',
      type: 'number',
    });
  });

  it.each(['message', 'tags[message]', 'tags[message,unknown]', 'xtags[message,string]'])(
    'returns null for %s',
    key => {
      expect(parseTypedTagKey(key)).toBeNull();
    }
  );
});

describe('getTraceItemAttributeDefinition', () => {
  it('finds a Sentry attribute registered by its typed key', () => {
    expect(
      getTraceItemAttributeDefinition('tags[code.line.number,number]', 'log')?.desc
    ).toContain('The line number');
  });

  it.each([
    {key: 'tags[message,string]', type: 'log' as const},
    {key: 'tags[payload_size,number]', type: 'log' as const},
    {key: 'tags[message,string]', type: 'span' as const},
  ])(
    'does not apply a Sentry alias definition to $key, a user attribute that collides with it',
    ({key, type}) => {
      expect(getTraceItemAttributeDefinition(key, type)?.desc).toBeUndefined();
    }
  );

  it('falls back to the convention of the same name and type', () => {
    expect(
      getTraceItemAttributeDefinition('tags[app.in_foreground,boolean]', 'span')
    ).toEqual(
      expect.objectContaining({
        desc: 'Whether the application is currently in the foreground.',
        valueType: FieldValueType.BOOLEAN,
      })
    );
  });

  it('keeps the value type the key declares rather than the convention one', () => {
    // `cache.item_age` is a duration convention, but a wrapped number is
    // searched as a plain number.
    expect(
      getTraceItemAttributeDefinition('tags[cache.item_age,number]', 'span')
    ).toEqual(
      expect.objectContaining({
        desc: 'The age of the cache entry in seconds, measured at read time.',
        valueType: FieldValueType.NUMBER,
      })
    );
  });

  it('ignores a convention whose type does not match the key', () => {
    expect(
      getTraceItemAttributeDefinition('tags[app.in_foreground,string]', 'span')?.desc
    ).toBeUndefined();
  });

  it('only falls back to conventions for trace item datasets', () => {
    expect(
      getTraceItemAttributeDefinition('tags[app.in_foreground,boolean]', 'event')
    ).toBeNull();
  });
});
