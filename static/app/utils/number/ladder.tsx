import orderBy from 'lodash/orderBy';

type Rung<T> = {
  max: number;
  min: number;
  value: T;
};

/**
 * Class that represents a value ladder. Given a ladder of increasing thresholds,
 * the ladder can match an incoming value against the known intervals.
 *
 * @example
 * ```javascript
 * // Selecting a quota based on team size
 * const ladder = new Ladder([
 *   [0, 10],
 *   [10, 100_000],
 *   [30, 1_000_000],
 * ]);
 *
 * const quota = ladder.step(0); // Quota for small teams is 10
 * const quota = ladder.step(12); // Quota for a 10-20 person team is 100,000
 * const quota = ladder.step(120); // Quota for a 30 person or higher team is 1,000,000
 * ```
 */
export class Ladder<T> {
  rungs: Rung<T>[];

  // At least one rung is required by the type
  constructor(rungs: [Rung<T>, ...Rung<T>[]]) {
    // Filter out sparse array slots just in case
    const filteredRungs = rungs.filter(Boolean);

    if (filteredRungs.length === 0) {
      throw new Error('No rungs provided');
    }

    const sortedRungs = orderBy(filteredRungs, rung => rung.min, 'asc');

    for (let i = 1; i < sortedRungs.length; i += 1) {
      const previousRung = sortedRungs[i - 1]!;
      const rung = sortedRungs[i]!;

      if (previousRung.max > rung.min) {
        throw new Error(
          `Rung of value ${rung.value} overlaps with rung of value ${previousRung.value}`
        );
      }
    }

    this.rungs = sortedRungs;
  }

  rung(value: number) {
    return this.rungs.find(r => {
      return value >= r.min && value < r.max;
    })?.value;
  }

  get min() {
    return this.rungs.at(0)!.value;
  }

  get max() {
    return this.rungs.at(-1)!.value;
  }
}
