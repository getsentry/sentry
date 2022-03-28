import {objectFromEntries} from 'sentry/utils/objectFromEntries';

describe('objectFromEntries', () => {
  it.each([[null], [undefined]])('crashes if non iterable obj is passed', value => {
    expect(() => objectFromEntries(value)).toThrow(TypeError);
  });

  it.each([
    [new Map([['key', 'value']]), {key: 'value'}],
    [new Set([['key']]), {key: undefined}],
    [[['key', 'value']], {key: 'value'}],
  ])('creates an obj entry for %s', (input, output) => {
    expect(objectFromEntries(input)).toEqual(output);
    expect(objectFromEntries(input)).toEqual(Object.fromEntries(input));
  });
});
