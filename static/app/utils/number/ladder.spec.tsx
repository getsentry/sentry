import {Ladder} from './ladder';

describe('Ladder', () => {
  test('matches an integer range', () => {
    const ladder = new Ladder([
      {min: 0, max: 10, value: 'first'},
      {min: 10, max: 20, value: 'second'},
      {min: 20, max: 50, value: 'third'},
    ]);

    expect(ladder.rung(-10)).toBeUndefined();
    expect(ladder.rung(5)).toBe('first');
    expect(ladder.rung(15)).toBe('second');
    expect(ladder.rung(25)).toBe('third');
    expect(ladder.rung(58)).toBeUndefined();
  });

  test('must provide at least one range', () => {
    // @ts-ignore
    expect(() => new Ladder([])).toThrow();
  });

  test('cannot have overlapping ranges', () => {
    expect(
      () =>
        new Ladder([
          {min: 0, max: 10, value: 'first'},
          {min: 10, max: 20, value: 'second'},
          {min: 15, max: 25, value: 'third'},
        ])
    ).toThrow();
  });

  test('may have range gaps', () => {
    const ladder = new Ladder([
      {min: 0, max: 10, value: 'first'},
      {min: 10, max: 20, value: 'second'},
      {min: 50, max: 100, value: 'third'},
    ]);

    expect(ladder.rung(25)).toBeUndefined();
  });

  test('range minimum is inclusive', () => {
    const ladder = new Ladder([
      {min: 0, max: 10, value: 'first'},
      {min: 10, max: 20, value: 'second'},
      {min: 20, max: 50, value: 'third'},
    ]);

    expect(ladder.rung(0)).toBe('first');
    expect(ladder.rung(10)).toBe('second');
  });

  test('provides the min and max value', () => {
    const ladder = new Ladder([
      {min: 0, max: 10, value: 'first'},
      {min: 10, max: 20, value: 'second'},
      {min: 20, max: 50, value: 'third'},
    ]);

    expect(ladder.min).toBe('first');
    expect(ladder.max).toBe('third');
  });

  test('enforces type', () => {
    type Salutation = 'Hello' | 'Hi';

    const ladder = new Ladder([
      {min: 0, max: 10, value: 'Hello' as Salutation},
      {min: 10, max: 20, value: 'Hi' as Salutation},
    ]);

    const salutation = ladder.rung(0);
    expect(salutation === 'Hi').toBeFalsy();
  });
});
