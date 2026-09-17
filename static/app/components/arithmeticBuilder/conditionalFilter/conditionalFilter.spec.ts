import {
  formatConditionalFilterClause,
  getConditionalFilterEditContext,
  replaceConditionalFilterClause,
} from 'sentry/components/arithmeticBuilder/conditionalFilter/conditionalFilter';

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

  it('shows an empty key query right after an open parenthesis', () => {
    expect(getConditionalFilterEditContext('(', 1)).toMatchObject({
      phase: 'key',
      editText: '',
      replaceStart: 1,
      replaceEnd: 1,
    });
  });

  it('keeps key mode when typing after an open parenthesis', () => {
    expect(getConditionalFilterEditContext('(span', 5)).toMatchObject({
      phase: 'key',
      editText: 'span',
      replaceStart: 1,
      replaceEnd: 5,
    });
  });

  it('keeps value mode for a key typed after an open parenthesis', () => {
    expect(getConditionalFilterEditContext('(span.op:', 9)).toMatchObject({
      phase: 'value',
      filterKey: 'span.op',
      editText: '',
      replaceStart: 1,
      replaceEnd: 9,
    });
  });

  it('ignores a trailing close parenthesis when reading the filter key', () => {
    const value = '(span.op:db)';
    expect(getConditionalFilterEditContext(value, value.length - 1)).toMatchObject({
      phase: 'value',
      filterKey: 'span.op',
      editText: 'db',
      valueQuery: 'db',
    });
  });

  it('keeps next-key replace range inside grouping parentheses', () => {
    const value = '(span.op:db span)';
    expect(getConditionalFilterEditContext(value, value.length - 1)).toMatchObject({
      phase: 'key',
      editText: 'span',
      replaceStart: 12,
      replaceEnd: value.length - 1,
    });
  });

  it('stays in value mode for a bracketed list with spaces', () => {
    const value = 'span.op:[db, http]';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'value',
      filterKey: 'span.op',
      editText: '[db, http]',
      valueQuery: '[db, http]',
    });
  });

  it('stays in value mode while typing an unclosed bracketed list', () => {
    const value = 'span.op:[db, htt';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'value',
      filterKey: 'span.op',
      editText: '[db, htt',
      valueQuery: '[db, htt',
    });
  });

  it('uses key mode after a completed bracketed list and trailing space', () => {
    const value = 'span.op:[db, http] ';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'key',
      editText: '',
    });
  });

  it('stays in value mode for quoted entries inside a bracketed list', () => {
    const value = 'agent_name:["Agent Run","Assisted Query"]';
    expect(getConditionalFilterEditContext(value, value.length)).toMatchObject({
      phase: 'value',
      filterKey: 'agent_name',
      editText: '["Agent Run","Assisted Query"]',
      valueQuery: '["Agent Run","Assisted Query"]',
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

  it('preserves a leading parenthesis when selecting a key suggestion', () => {
    expect(replaceConditionalFilterClause('(', 1, 'span.op:')).toEqual({
      newCursorIndex: 9,
      newValue: '(span.op:',
    });
  });

  it('preserves grouping parentheses when selecting a value suggestion', () => {
    expect(replaceConditionalFilterClause('(span.op:)', 9, 'span.op:db')).toEqual({
      newCursorIndex: 11,
      newValue: '(span.op:db)',
    });
  });

  it('preserves a trailing parenthesis when selecting a next-key suggestion', () => {
    const value = '(span.op:db span)';
    expect(
      replaceConditionalFilterClause(value, value.length - 1, 'span.status:')
    ).toEqual({
      newCursorIndex: 24,
      newValue: '(span.op:db span.status:)',
    });
  });

  it('does not rewrite a bracketed list when selecting a key suggestion mid-list', () => {
    const value = 'span.op:[db, http]';
    // Cursor on `http` inside the list must still replace the whole clause as a value
    // edit path would; selecting a key suggestion should not split on the space.
    expect(
      replaceConditionalFilterClause(value, value.length - 2, 'span.status:')
    ).toEqual({
      newCursorIndex: 12,
      newValue: 'span.status:',
    });
  });
});

describe('formatConditionalFilterClause', () => {
  it('quotes values that contain spaces', () => {
    expect(formatConditionalFilterClause('organization.slug', 'hello there')).toBe(
      'organization.slug:"hello there"'
    );
  });

  it('leaves simple values unquoted', () => {
    expect(formatConditionalFilterClause('organization.slug', 'sentry')).toBe(
      'organization.slug:sentry'
    );
  });

  it('preserves bracketed list syntax', () => {
    expect(formatConditionalFilterClause('span.op', '[db, http]')).toBe(
      'span.op:[db, http]'
    );
  });
});
