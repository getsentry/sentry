import {getFieldsForConstructedQuery} from 'sentry/views/explore/multiQueryMode/locationUtils';

describe('getFieldsForConstructedQuery', () => {
  it('extracts the column argument from a plain aggregate', () => {
    expect(getFieldsForConstructedQuery(['avg(span.duration)'])).toEqual([
      'id',
      'span.duration',
      'timestamp',
    ]);
  });

  it('extracts the column argument from a conditional aggregate', () => {
    expect(getFieldsForConstructedQuery(['avg_if(`span.op:db`,span.duration)'])).toEqual([
      'id',
      'span.duration',
      'timestamp',
    ]);
  });

  it('does not treat a filter-only _if argument as a field', () => {
    expect(getFieldsForConstructedQuery(['count_if(`span.op:db`)'])).toEqual([
      'id',
      'timestamp',
    ]);
  });
});
