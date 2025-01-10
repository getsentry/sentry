import orderBy from 'lodash/orderBy';

type Rung<T> = [threshold: number, value: T];

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
    if (!rungs.some(rung => rung[0] === 0)) {
      throw new Error('At least one rung in the ladder must start at 0');
    }

    const sortedRungs = orderBy(rungs, rung => rung[0], 'desc');

    const rungThresholds = sortedRungs.map(rung => rung[0]);
    const uniqueThresholds = new Set(rungThresholds);

    if (uniqueThresholds.size !== rungThresholds.length) {
      throw new Error('Rung thresholds are not unique');
    }

    this.rungs = sortedRungs;
  }

  rung(value: number) {
    if (value < 0) {
      throw new Error('Cannot check ladder for values below 0');
    }

    const rung = this.rungs.find(([threshold]) => {
      return value >= threshold;
    }) as Rung<T>;

    return rung[1];
  }

  get min() {
    return (this.rungs.at(-1) as Rung<T>)[1];
  }

  get max() {
    return (this.rungs.at(0) as Rung<T>)[1];
  }
}
