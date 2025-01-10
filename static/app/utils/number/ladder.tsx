import orderBy from 'lodash/orderBy';

type Rung = [threshold: number, value: any];

/**
 * Class that represents a value ladder. Given a ladder of increasing thresholds, the ladder can match an incoming value against the known intervals.
 */
export class Ladder {
  rungs: Rung[];

  // At least one rung is required by the type
  constructor(rungs: [Rung, ...Rung[]]) {
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
    }) as Rung;

    return rung[1];
  }

  get min() {
    return (this.rungs.at(0) as Rung)[1];
  }

  get max() {
    return (this.rungs.at(-1) as Rung)[1];
  }
}
