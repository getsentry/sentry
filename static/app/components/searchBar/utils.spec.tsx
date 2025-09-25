import {escapeTagValue} from 'sentry/components/searchBar/utils';

describe('escapeTagValue()', () => {
  it('wraps tags containing quotes in quotes', () => {
    expect(escapeTagValue('foo"bar')).toBe('"foo\\"bar"');
  });
  it('wraps tags containing spaces in quotes', () => {
    expect(escapeTagValue('foo bar')).toBe('"foo bar"');
  });
  it('does not escape tags in array style', () => {
    expect(escapeTagValue('[me, none]')).toBe('[me, none]');
    expect(escapeTagValue('[me, my_teams, none]')).toBe('[me, my_teams, none]');
  });
});
