import {TermOperator, WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {
  addSearchFilterToQuery,
  getFilterRows,
  getSearchFilterDescriptor,
  removeSearchFilterFromQuery,
  replaceSearchFilterInQuery,
} from 'sentry/views/explore/components/traceItemFilterQuery';

describe('addSearchFilterToQuery', () => {
  it('extracts a comparison operator from a generically parsed attribute', () => {
    expect(getSearchFilterDescriptor('span.duration:>=100ms')).toEqual({
      attributeKey: 'span.duration',
      operator: TermOperator.GREATER_THAN_EQUAL,
      value: '100ms',
    });
  });

  it('does not add the same filter twice', () => {
    expect(
      addSearchFilterToQuery('project:frontend-react', {
        key: 'project',
        op: TermOperator.DEFAULT,
        value: 'frontend-react',
      })
    ).toBe('project:frontend-react');
  });

  it('preserves distinct values for the same attribute', () => {
    expect(
      addSearchFilterToQuery('project:frontend-react', {
        key: 'project',
        op: TermOperator.DEFAULT,
        value: 'backend-python',
      })
    ).toBe('project:frontend-react project:backend-python');
  });

  it('does not add the same negated filter twice', () => {
    expect(
      addSearchFilterToQuery('!project:frontend-react', {
        key: 'project',
        op: TermOperator.NOT_EQUAL,
        value: 'frontend-react',
      })
    ).toBe('!project:frontend-react');
  });

  it.each([
    [TermOperator.CONTAINS, '', WildcardOperators.CONTAINS],
    [TermOperator.DOES_NOT_CONTAIN, '!', WildcardOperators.CONTAINS],
    [TermOperator.STARTS_WITH, '', WildcardOperators.STARTS_WITH],
    [TermOperator.DOES_NOT_START_WITH, '!', WildcardOperators.STARTS_WITH],
    [TermOperator.ENDS_WITH, '', WildcardOperators.ENDS_WITH],
    [TermOperator.DOES_NOT_END_WITH, '!', WildcardOperators.ENDS_WITH],
  ])('serializes the %s wildcard operator', (op, negation, wildcard) => {
    expect(
      addSearchFilterToQuery('', {
        key: 'span.description',
        op,
        value: 'checkout request',
      })
    ).toBe(`${negation}span.description:${wildcard}"checkout request"`);
  });

  it('preserves multiple wildcard values for the same attribute', () => {
    expect(
      addSearchFilterToQuery(`span.description:${WildcardOperators.CONTAINS}checkout`, {
        key: 'span.description',
        op: TermOperator.CONTAINS,
        value: 'payment',
      })
    ).toBe(
      `span.description:${WildcardOperators.CONTAINS}checkout ` +
        `span.description:${WildcardOperators.CONTAINS}payment`
    );
  });

  it('does not conflate exact and wildcard values when deduplicating', () => {
    expect(
      addSearchFilterToQuery('span.description:checkout', {
        key: 'span.description',
        op: TermOperator.CONTAINS,
        value: 'checkout',
      })
    ).toBe(
      `span.description:checkout span.description:${WildcardOperators.CONTAINS}checkout`
    );
  });
});

describe('getFilterRows', () => {
  it('returns one row for each flat filter', () => {
    expect(
      getFilterRows(
        'project:frontend-react tags[browser.name,string]:Chrome !span.op:http'
      )
    ).toEqual([
      'project:frontend-react',
      'tags[browser.name,string]:Chrome',
      '!span.op:http',
    ]);
  });

  it('keeps quoted and wildcard values intact', () => {
    expect(
      getFilterRows('span.description:"checkout request" transaction:*checkout*')
    ).toEqual(['span.description:"checkout request"', 'transaction:*checkout*']);
  });

  it('keeps a JSON filter visible and separates a subsequent filter', () => {
    const inputMessages =
      '[{"content": [{"text": "I want to buy plants for full sunlight"}], "role": "user"}]';
    const inputFilter = addSearchFilterToQuery('', {
      key: 'gen_ai.input.messages',
      op: TermOperator.CONTAINS,
      value: inputMessages,
    });

    expect(getFilterRows(inputFilter)).toEqual([inputFilter]);

    const query = addSearchFilterToQuery(inputFilter, {
      key: 'gen_ai.response.model',
      op: TermOperator.DEFAULT,
      value: 'gpt-4o',
    });

    expect(getFilterRows(query)).toEqual([inputFilter, 'gen_ai.response.model:gpt-4o']);
  });

  it('returns no rows for an empty query', () => {
    expect(getFilterRows('   ')).toEqual([]);
  });

  it('keeps complex search syntax together', () => {
    const query = '(project:frontend-react OR project:backend-python) error';

    expect(getFilterRows(query)).toEqual([query]);
  });
});

describe('filter row mutations', () => {
  it('removes only the selected filter', () => {
    const query =
      'environment:production gen_ai.response.model:gpt-4o span.op:gen_ai.request';

    expect(removeSearchFilterFromQuery(query, 1)).toBe(
      'environment:production span.op:gen_ai.request'
    );
  });

  it('replaces only the selected filter', () => {
    expect(
      replaceSearchFilterInQuery(
        'environment:production gen_ai.response.model:gpt-4o',
        1,
        {
          key: 'gen_ai.response.model',
          op: TermOperator.NOT_EQUAL,
          value: 'gpt-5',
        }
      )
    ).toBe('environment:production !gen_ai.response.model:gpt-5');
  });
});
