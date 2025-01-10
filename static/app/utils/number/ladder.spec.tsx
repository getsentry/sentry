import {Ladder} from './ladder';

describe('Ladder', () => {
  test('it picks the correct rung', () => {
    const ladder = new Ladder([
      [0, 'first'],
      [10, 'second'],
      [20, 'third'],
    ]);

    expect(ladder.rung(5)).toBe('first');
    expect(ladder.rung(15)).toBe('second');
  });

  test('ladder must start at 0', () => {
    expect(
      () =>
        new Ladder([
          [10, 'first'],
          [20, 'second'],
        ])
    ).toThrow();
  });

  test('ladders cannot have duplicate items', () => {
    expect(
      () =>
        new Ladder([
          [10, 'hello'],
          [20, 'goodbye'],
          [10, 'hi'],
        ])
    ).toThrow();
  });

  test('exact boundary match looks upward', () => {
    const ladder = new Ladder([
      [0, 'first'],
      [10, 'second'],
    ]);

    expect(ladder.rung(0)).toBe('first');
    expect(ladder.rung(10)).toBe('second');
  });

  test('top of ladder is the maximum', () => {
    const ladder = new Ladder([
      [0, 'first'],
      [10, 'second'],
    ]);

    expect(ladder.rung(15)).toBe('second');
  });

  test('cannot check for values below 0', () => {
    const ladder = new Ladder([
      [0, 'first'],
      [10, 'second'],
    ]);

    expect(() => ladder.rung(-1)).toThrow();
  });

  test('providers the min and max value', () => {
    const ladder = new Ladder([
      [10, 'second'],
      [0, 'first'],
    ]);

    expect(ladder.min).toBe('first');
    expect(ladder.max).toBe('second');
  });

  test('enforces type', () => {
    type Salutation = 'Hello' | 'Hi';

    const ladder = new Ladder([
      [0, 'Hello' as Salutation],
      [10, 'Hi' as Salutation],
    ]);

    const salutation = ladder.rung(0);
    expect(salutation === 'Hi').toBeFalsy();
  });
});
