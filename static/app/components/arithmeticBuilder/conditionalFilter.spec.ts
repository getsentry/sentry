import {
  formatConditionalFilterClause,
  formatConditionalFilterTagValue,
  getConditionalFilterClauseAtCursor,
  getConditionalFilterEditPhase,
  getConditionalFilterKeyQuery,
  parseConditionalFilterInput,
  replaceConditionalFilterClause,
} from 'sentry/components/arithmeticBuilder/conditionalFilter';

describe('getConditionalFilterClauseAtCursor', () => {
  it('returns the full string as one clause when there are no boolean operators', () => {
    expect(getConditionalFilterClauseAtCursor('organization.slug:sentry', 10)).toEqual({
      clause: 'organization.slug:sentry',
      clauseCursorIndex: 10,
      clauseEnd: 24,
      clauseStart: 0,
    });
  });

  it('returns the clause after a boolean operator', () => {
    const value = 'organization.slug:sentry and ';
    expect(getConditionalFilterClauseAtCursor(value, value.length)).toEqual({
      clause: '',
      clauseCursorIndex: 0,
      clauseEnd: 29,
      clauseStart: 29,
    });
  });

  it('returns the active clause when typing a second filter key', () => {
    const value = 'organization.slug:sentry and span.op';
    expect(getConditionalFilterClauseAtCursor(value, value.length)).toEqual({
      clause: 'span.op',
      clauseCursorIndex: 7,
      clauseEnd: 36,
      clauseStart: 29,
    });
  });

  it('does not split on boolean operators inside quoted values', () => {
    const value = 'span.description:"foo and bar" and span.op:';
    expect(getConditionalFilterClauseAtCursor(value, value.length)).toEqual({
      clause: 'span.op:',
      clauseCursorIndex: 8,
      clauseEnd: 43,
      clauseStart: 35,
    });
  });
});

describe('getConditionalFilterEditPhase', () => {
  it('uses key mode before the first colon in a clause', () => {
    expect(
      getConditionalFilterEditPhase('organization.slug:sentry and span.op', 36)
    ).toBe('key');
  });

  it('uses value mode after the colon while typing an unquoted value', () => {
    expect(
      getConditionalFilterEditPhase('organization.slug:sentry and span.op:db', 39)
    ).toBe('value');
  });

  it('uses key mode after a boolean operator', () => {
    const value = 'organization.slug:sentry and ';
    expect(getConditionalFilterEditPhase(value, value.length)).toBe('key');
  });

  it('uses key mode after a completed unquoted value and trailing space', () => {
    const value = 'organization.slug:sentry ';
    expect(getConditionalFilterEditPhase(value, value.length)).toBe('key');
  });

  it('stays in value mode for an unclosed quoted value', () => {
    const value = 'organization.slug:"hello there';
    expect(getConditionalFilterEditPhase(value, value.length)).toBe('value');
  });

  it('uses key mode after a closed quoted value', () => {
    const value = 'organization.slug:"hello there"';
    expect(getConditionalFilterEditPhase(value, value.length)).toBe('key');
  });

  it('uses key mode when typing a key after a completed value', () => {
    const value = 'organization.slug:sentry span';
    expect(getConditionalFilterEditPhase(value, value.length)).toBe('key');
  });
});

describe('parseConditionalFilterInput', () => {
  it('parses the active clause at the cursor', () => {
    expect(
      parseConditionalFilterInput('organization.slug:sentry and span.op:db', 39)
    ).toEqual({
      filterKey: 'span.op',
      valueQuery: 'db',
    });
  });

  it('strips an opening quote from the value query', () => {
    const value = 'organization.slug:"hello there';
    expect(parseConditionalFilterInput(value, value.length)).toEqual({
      filterKey: 'organization.slug',
      valueQuery: 'hello there',
    });
  });
});

describe('getConditionalFilterKeyQuery', () => {
  it('reads the key query from the active clause', () => {
    expect(getConditionalFilterKeyQuery('organization.slug:sentry and span', 34)).toBe(
      'span'
    );
  });

  it('reads the key query after a completed value', () => {
    const value = 'organization.slug:sentry spa';
    expect(getConditionalFilterKeyQuery(value, value.length)).toBe('spa');
  });

  it('returns an empty key query after a completed value and space', () => {
    const value = 'organization.slug:sentry ';
    expect(getConditionalFilterKeyQuery(value, value.length)).toBe('');
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
});
