import {getNextDirection, getNextSort} from 'sentry/components/tables/getNextSort';

describe('getNextDirection', () => {
  it('returns desc when the column is unsorted', () => {
    expect(getNextDirection(undefined)).toBe('desc');
  });

  it('returns the given default when the column is unsorted', () => {
    expect(getNextDirection(undefined, 'asc')).toBe('asc');
  });

  it('returns desc when the column is sorted ascending', () => {
    expect(getNextDirection('asc')).toBe('desc');
  });

  it('returns asc when the column is sorted descending', () => {
    expect(getNextDirection('desc')).toBe('asc');
  });
});

describe('getNextSort', () => {
  it('sorts descending when another column holds the sort', () => {
    expect(getNextSort('duration', {field: 'timestamp', kind: 'asc'})).toEqual({
      field: 'duration',
      kind: 'desc',
    });
  });

  it('sorts by the given default when another column holds the sort', () => {
    expect(getNextSort('duration', {field: 'timestamp', kind: 'desc'}, 'asc')).toEqual({
      field: 'duration',
      kind: 'asc',
    });
  });

  it('flips the direction when the column already holds the sort', () => {
    expect(getNextSort('duration', {field: 'duration', kind: 'desc'})).toEqual({
      field: 'duration',
      kind: 'asc',
    });
  });

  it('sorts descending when no column holds the sort', () => {
    expect(getNextSort('duration', undefined)).toEqual({
      field: 'duration',
      kind: 'desc',
    });
  });
});
