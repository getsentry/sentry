import {canIncludePreviousPeriod} from 'app/views/events/utils/canIncludePreviousPeriod';

describe('canIncludePreviousPeriod', function() {
  it('does not include if `includePrevious` is false', function() {
    expect(canIncludePreviousPeriod(false, '7d')).toBe(false);
  });

  it('is true if period is less than or equal to 45 days', function() {
    expect(canIncludePreviousPeriod(true, '45d')).toBe(true);
  });

  it('is false if period is greater than 45d', function() {
    expect(canIncludePreviousPeriod(true, '46d')).toBe(false);
  });

  it('returns value of `includePrevious` if no period', function() {
    expect(canIncludePreviousPeriod(true)).toBe(true);
    expect(canIncludePreviousPeriod(false)).toBe(false);
  });
});
