import {RangeMap} from './rangeMap';

describe('RangeMap', () => {
  test('matches an integer range', () => {
    const ladder = new RangeMap([
      {min: 0, max: 10, value: 'first'},
      {min: 10, max: 20, value: 'second'},
      {min: 20, max: 50, value: 'third'},
    ]);

    expect(ladder.get(-10)).toBeUndefined();
    expect(ladder.get(5)).toBe('first');
    expect(ladder.get(15)).toBe('second');
    expect(ladder.get(25)).toBe('third');
    expect(ladder.get(58)).toBeUndefined();
  });

  test('must provide at least one range', () => {
    // @ts-ignore
    expect(() => new RangeMap([])).toThrow();
  });

  test('cannot have overlapping ranges', () => {
    expect(
      () =>
        new RangeMap([
          {min: 0, max: 10, value: 'first'},
          {min: 10, max: 20, value: 'second'},
          {min: 15, max: 25, value: 'third'},
        ])
    ).toThrow();
  });

  test('may have range gaps', () => {
    const ladder = new RangeMap([
      {min: 0, max: 10, value: 'first'},
      {min: 10, max: 20, value: 'second'},
      {min: 50, max: 100, value: 'third'},
    ]);

    expect(ladder.get(25)).toBeUndefined();
  });

  test('range minimum is inclusive', () => {
    const ladder = new RangeMap([
      {min: 0, max: 10, value: 'first'},
      {min: 10, max: 20, value: 'second'},
      {min: 20, max: 50, value: 'third'},
    ]);

    expect(ladder.get(0)).toBe('first');
    expect(ladder.get(10)).toBe('second');
  });

  test('provides the min and max value', () => {
    const ladder = new RangeMap([
      {min: 0, max: 10, value: 'first'},
      {min: 10, max: 20, value: 'second'},
      {min: 20, max: 50, value: 'third'},
    ]);

    expect(ladder.min).toBe('first');
    expect(ladder.max).toBe('third');
  });

  test('enforces type', () => {
    type Salutation = 'Hello' | 'Hi';

    const ladder = new RangeMap([
      {min: 0, max: 10, value: 'Hello' as Salutation},
      {min: 10, max: 20, value: 'Hi' as Salutation},
    ]);

    const salutation = ladder.get(0);
    expect(salutation === 'Hi').toBeFalsy();
  });
});
