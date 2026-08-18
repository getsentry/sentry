import {TermOperator, WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {addSearchFilterToQuery} from 'sentry/views/explore/components/traceItemFilterActions';

describe('addSearchFilterToQuery', () => {
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
