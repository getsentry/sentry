import {
  formatConditionalFilterClause,
  formatConditionalFilterTagValue,
  getConditionalFilterEditContext,
  replaceConditionalFilterClause,
} from 'sentry/components/arithmeticBuilder/conditionalFilter';

describe('getConditionalFilterEditContext', () => {
  it('treats the full string as one clause when there are no boolean operators', () => {
    expect(getConditionalFilterEditContext('organization.slug:sentry', 10)).toMatchObject(
      {
        phase: 'key',
        editText: 'organizati',
        replaceStart: 0,
        replaceEnd: 24,
      }
    );
  });

  it('starts a new key clause after a boolean operator', () => {
    const value = 'organization.slug:sentry and ';
    expect(getConditionalFilterEditContext(value, value.length)).toEqual({
      phase: 'key',
      editText: '',
      replaceStart: 29,
      replaceEnd: 29,
    });
  });

  it('uses key mode for the active clause when typing a second filter key', () => {
    const value = 'organization.slug:sentry and span.op';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'key',
      editText: 'span.op',
      replaceStart: 29,
      replaceEnd: 36,
    });
  });

  it('does not split on boolean operators inside quoted values', () => {
    const value = 'span.description:"foo and bar" and span.op:';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'value',
      filterKey: 'span.op',
      valueQuery: '',
      replaceStart: 35,
      replaceEnd: 43,
    });
  });

  it('limits the clause to the next operator when the cursor is on a boolean operator', () => {
    const value = 'span.op:db and span.description:foo and span.status:ok';
    const andIndex = value.indexOf(' and ');
    // Cursor on `and` is treated as the start of the following clause (key mode).
    expect(getConditionalFilterEditContext(value, andIndex + 1)).toMatchObject({
      phase: 'key',
      editText: '',
      replaceStart: 15,
      replaceEnd: 35,
    });
  });

  it('limits the clause to the next operator when the cursor is at the start of the next clause', () => {
    const value = 'span.op:db and span.description:foo and span.status:ok';
    const secondClauseStart = value.indexOf('span.description');
    expect(getConditionalFilterEditContext(value, secondClauseStart)).toMatchObject({
      phase: 'key',
      editText: '',
      replaceStart: 15,
      replaceEnd: 35,
    });
  });

  it('uses key mode before the first colon in a clause', () => {
    expect(
      getConditionalFilterEditContext('organization.slug:sentry and span.op', 36).phase
    ).toBe('key');
  });

  it('uses value mode after the colon while typing an unquoted value', () => {
    expect(
      getConditionalFilterEditContext('organization.slug:sentry and span.op:db', 39)
    ).toMatchObject({
      phase: 'value',
      filterKey: 'span.op',
      valueQuery: 'db',
    });
  });

  it('uses key mode after a boolean operator', () => {
    const value = 'organization.slug:sentry and ';
    expect(getConditionalFilterEditContext(value, value.length).phase).toBe('key');
  });

  it('uses key mode after a completed unquoted value and trailing space', () => {
    const value = 'organization.slug:sentry ';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'key',
      editText: '',
    });
  });

  it('stays in value mode for an unclosed quoted value', () => {
    const value = 'organization.slug:"hello there';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'value',
      filterKey: 'organization.slug',
      valueQuery: 'hello there',
    });
  });

  it('uses key mode after a closed quoted value', () => {
    const value = 'organization.slug:"hello there"';
    expect(getConditionalFilterEditContext(value, value.length).phase).toBe('key');
  });

  it('uses key mode when typing a key after a completed value', () => {
    const value = 'organization.slug:sentry span';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'key',
      editText: 'span',
    });
  });

  it('reads the key query from the active clause', () => {
    expect(
      getConditionalFilterEditContext('organization.slug:sentry and span', 34)
    ).toMatchObject({
      phase: 'key',
      editText: 'span',
    });
  });

  it('reads the key query after a completed value', () => {
    const value = 'organization.slug:sentry spa';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'key',
      editText: 'spa',
    });
  });

  it('returns an empty key query after a completed value and space', () => {
    const value = 'organization.slug:sentry ';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'key',
      editText: '',
    });
  });
});

describe('replaceConditionalFilterClause', () => {
  it('replaces only the active clause when selecting a key suggestion', () => {
    const value = 'organization.slug:sentry and ';
    expect(replaceConditionalFilterClause(value, value.length, 'span.op:')).toEqual({
      newCursorIndex: 37,
      newValue: 'organization.slug:sentry and span.op:',
    });
  });

  it('appends a key after a completed value instead of replacing it', () => {
    const value = 'organization.slug:sentry ';
    expect(replaceConditionalFilterClause(value, value.length, 'span.op:')).toEqual({
      newCursorIndex: 33,
      newValue: 'organization.slug:sentry span.op:',
    });
  });
});

describe('formatConditionalFilterTagValue', () => {
  it('quotes values that contain spaces', () => {
    expect(formatConditionalFilterTagValue('hello there')).toBe('"hello there"');
    expect(formatConditionalFilterClause('organization.slug', 'hello there')).toBe(
      'organization.slug:"hello there"'
    );
  });

  it('leaves simple values unquoted', () => {
    expect(formatConditionalFilterTagValue('sentry')).toBe('sentry');
  });

  it('preserves bracketed list syntax', () => {
    expect(formatConditionalFilterTagValue('[value1, value2]')).toBe('[value1, value2]');
    expect(formatConditionalFilterClause('span.op', '[db, http]')).toBe(
      'span.op:[db, http]'
    );
  });
});
