import {bucketReleases} from './bucketReleases';

const HOUR = 60 * 60 * 1000;
const START = new Date('2026-11-03T12:00:00Z').getTime();

const buckets = [0, 1, 2].map(index => ({
  start: START + index * HOUR,
  end: START + (index + 1) * HOUR,
}));

function release(version: string, offset: number) {
  return {version, timestamp: new Date(START + offset).toISOString()};
}

describe('bucketReleases', () => {
  it('returns only the buckets that have releases', () => {
    const first = release('1.0.0', 10 * 60 * 1000);
    const second = release('1.0.1', 50 * 60 * 1000);
    const third = release('1.1.0', 2 * HOUR + 5 * 60 * 1000);

    expect(bucketReleases([third, first, second], buckets)).toEqual([
      {...buckets[0], releases: [first, second]},
      {...buckets[2], releases: [third]},
    ]);
  });

  it('includes the bucket start and excludes the bucket end', () => {
    const atStart = release('1.0.0', HOUR);
    const atEnd = release('1.0.1', 2 * HOUR);

    expect(bucketReleases([atStart, atEnd], buckets)).toEqual([
      {...buckets[1], releases: [atStart]},
      {...buckets[2], releases: [atEnd]},
    ]);
  });

  it('leaves out releases outside every bucket', () => {
    const before = release('0.9.0', -1);
    const after = release('2.0.0', 3 * HOUR);

    expect(bucketReleases([before, after], buckets)).toEqual([]);
  });

  it('returns nothing without buckets', () => {
    expect(bucketReleases([release('1.0.0', 0)], [])).toEqual([]);
  });
});
