import {
  addArrayMembershipOperator,
  stripArrayMembershipOperator,
} from 'sentry/components/searchSyntax/utils';

describe('stripArrayMembershipOperator', () => {
  it('strips an in-progress or complete membership operator so the key still matches', () => {
    expect(stripArrayMembershipOperator('csv_headers[')).toBe('csv_headers');
    expect(stripArrayMembershipOperator('csv_headers[*')).toBe('csv_headers');
    expect(stripArrayMembershipOperator('csv_headers[*]')).toBe('csv_headers');
    // The tag form carries the operator on the name, inside the bracket.
    expect(stripArrayMembershipOperator('tags[csv_headers[*],array]')).toBe(
      'tags[csv_headers,array]'
    );
  });

  it('leaves ordinary keys and the bare tag form untouched', () => {
    expect(stripArrayMembershipOperator('csv_headers')).toBe('csv_headers');
    // A `[` that is not a trailing membership operator (typing the tag form).
    expect(stripArrayMembershipOperator('tags[csv')).toBe('tags[csv');
    expect(stripArrayMembershipOperator('tags[csv_headers,array]')).toBe(
      'tags[csv_headers,array]'
    );
  });
});

describe('addArrayMembershipOperator', () => {
  it('adds the operator inside the bracket for the tag form', () => {
    expect(addArrayMembershipOperator('tags[csv_headers,array]')).toBe(
      'tags[csv_headers[*],array]'
    );
  });

  it('adds a trailing operator for the bare first-class form', () => {
    expect(addArrayMembershipOperator('some.array')).toBe('some.array[*]');
  });

  it('does not double an operator that is already present', () => {
    expect(addArrayMembershipOperator('tags[csv_headers[*],array]')).toBe(
      'tags[csv_headers[*],array]'
    );
    expect(addArrayMembershipOperator('some.array[*]')).toBe('some.array[*]');
  });
});
