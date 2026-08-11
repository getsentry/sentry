import {stripMembershipOperator} from 'sentry/components/searchQueryBuilder/tokens/useSortedFilterKeyItems';

describe('stripMembershipOperator', () => {
  it('strips an in-progress or complete membership operator so the key still matches', () => {
    expect(stripMembershipOperator('csv_headers[')).toBe('csv_headers');
    expect(stripMembershipOperator('csv_headers[*')).toBe('csv_headers');
    expect(stripMembershipOperator('csv_headers[*]')).toBe('csv_headers');
    expect(stripMembershipOperator('tags[csv_headers,array][*]')).toBe(
      'tags[csv_headers,array]'
    );
  });

  it('leaves ordinary keys and mid-typed tag forms untouched', () => {
    expect(stripMembershipOperator('csv_headers')).toBe('csv_headers');
    // A `[` that is not a trailing membership operator (typing the tag form).
    expect(stripMembershipOperator('tags[csv')).toBe('tags[csv');
    expect(stripMembershipOperator('tags[csv_headers,array]')).toBe(
      'tags[csv_headers,array]'
    );
  });
});
