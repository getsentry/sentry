import {stripArrayMembershipOperator} from 'sentry/components/searchSyntax/utils';

describe('stripArrayMembershipOperator', () => {
  it('strips an in-progress or complete membership operator so the key still matches', () => {
    expect(stripArrayMembershipOperator('csv_headers[')).toBe('csv_headers');
    expect(stripArrayMembershipOperator('csv_headers[*')).toBe('csv_headers');
    expect(stripArrayMembershipOperator('csv_headers[*]')).toBe('csv_headers');
    expect(stripArrayMembershipOperator('tags[csv_headers,array][*]')).toBe(
      'tags[csv_headers,array]'
    );
  });

  it('leaves ordinary keys and mid-typed tag forms untouched', () => {
    expect(stripArrayMembershipOperator('csv_headers')).toBe('csv_headers');
    // A `[` that is not a trailing membership operator (typing the tag form).
    expect(stripArrayMembershipOperator('tags[csv')).toBe('tags[csv');
    expect(stripArrayMembershipOperator('tags[csv_headers,array]')).toBe(
      'tags[csv_headers,array]'
    );
  });
});
