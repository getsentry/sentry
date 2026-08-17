import {createRandom, pick} from './seed';

function take(seed: string, count: number): number[] {
  const random = createRandom(seed);
  return Array.from({length: count}, () => random());
}

describe('createRandom', () => {
  it('produces the same sequence when given the same seed', () => {
    const sequences = [take('Resolve all errors', 8), take('Resolve all errors', 8)];

    expect(sequences[0]).toEqual(sequences[1]);
  });

  it('produces a different sequence when given a different seed', () => {
    const sequences = [take('Resolve all errors', 8), take('Resolve all error', 8)];

    expect(sequences[0]).not.toEqual(sequences[1]);
  });

  it('produces values within the unit interval', () => {
    const values = take('Alerts allow you to monitor your errors', 500);

    expect(values.every(value => value >= 0 && value < 1)).toBe(true);
  });

  it('does not repeat the first value across the sequence', () => {
    const values = take('Showing %s of %s events', 50);

    expect(new Set(values).size).toBe(50);
  });
});

describe('pick', () => {
  it('returns the same item when given the same seed', () => {
    const items = ['UwU', 'OwO', '>w<', '^-^'];

    const picks = [
      pick(createRandom('release health'), items),
      pick(createRandom('release health'), items),
    ];

    expect(picks[0]).toBe(picks[1]);
  });

  it('returns an item from the list', () => {
    const items = ['UwU', 'OwO', '>w<', '^-^'];

    const picks = Array.from({length: 50}, (_, index) =>
      pick(createRandom(`seed ${index}`), items)
    );

    expect(picks.every(value => items.includes(value))).toBe(true);
  });
});
