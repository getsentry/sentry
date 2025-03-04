import {createReleaseBuckets} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/utils/createReleaseBuckets';

function createTimeSeries(numItems: number, intervalMs = 1000, start = new Date()) {
  const timeSeries = [
    {
      data: Array.from(Array(numItems)).map((_, i) => ({
        value: 0, // don't care about value
        timestamp: new Date(start.getTime() + i * intervalMs).toISOString(),
      })),
    },
  ];

  // find min/max timestamp of *all* timeSeries
  let minTime: Date | undefined;
  let maxTime: Date | undefined;

  for (const currentSeries of timeSeries) {
    if (currentSeries.data.length < 2) {
      continue;
    }

    const firstData = currentSeries.data[0];
    const lastData = currentSeries.data[currentSeries.data.length - 1];
    // I hope `data` is sorted
    if (!minTime || new Date(firstData!.timestamp) < minTime) {
      minTime = new Date(firstData!.timestamp);
    }
    if (!maxTime || new Date(lastData!.timestamp) > maxTime) {
      maxTime = new Date(lastData!.timestamp);
    }
  }

  return {minTime: minTime?.getTime(), maxTime: maxTime?.getTime()};
}

describe('createReleaseBuckets', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 10],
    [10, 10],
    [20, 10],
    [50, 10],
    [100, 10],
    [300, 10],
  ])(
    'creates correct # of buckets for timeSeries with %d items',
    (numItems, expectedBuckets) => {
      const {minTime, maxTime} = createTimeSeries(numItems);
      const buckets = createReleaseBuckets(minTime, maxTime, []);
      expect(buckets).toHaveLength(expectedBuckets);
    }
  );

  it('creates the correct buckets', () => {
    const {minTime, maxTime} = createTimeSeries(13);
    // let's change the last timeseries
    const newEndingTs = maxTime! + 2235;

    const buckets = createReleaseBuckets(minTime, newEndingTs, []);
    expect(buckets).toEqual([
      [1508208080000, 0, 1508208081424, 0, []],
      [1508208081424, 0, 1508208082848, 0, []],
      [1508208082848, 0, 1508208084272, 0, []],
      [1508208084272, 0, 1508208085696, 0, []],
      [1508208085696, 0, 1508208087120, 0, []],
      [1508208087120, 0, 1508208088544, 0, []],
      [1508208088544, 0, 1508208089968, 0, []],
      [1508208089968, 0, 1508208091392, 0, []],
      [1508208091392, 0, 1508208092816, 0, []],
      [1508208092816, 0, 1508208094235, 0, []],
    ]);
  });

  it('buckets releases correctly', () => {
    const {minTime, maxTime} = createTimeSeries(13);
    // let's change the last timeseries
    const newEndingTs = maxTime + 2235;

    const releases = [
      {
        version: 'ui@0.1.2',
        date: new Date(1508208080000).toISOString(),
      },
      {
        version: 'ui@0.1.22',
        date: new Date(1508208081323).toISOString(),
      },
      {
        version: 'ui@0.1.3',
        date: new Date(1508208081423).toISOString(),
      },
      {
        version: 'ui@0.1.4',
        date: new Date(1508208083000).toISOString(),
      },
      {
        version: 'ui@0.1.41',
        date: new Date(1508208084269).toISOString(),
      },
      {
        version: 'ui@0.1.51',
        date: new Date(1508208092816).toISOString(),
      },
      {
        version: 'ui@0.1.52',
        date: new Date(1508208094230).toISOString(),
      },
      {
        version: 'ui@0.1.53',
        date: new Date(1508208094235).toISOString(),
      },
      {
        version: 'ui@0.1.54',
        date: new Date(1508208094235).toISOString(),
      },
      // Should not be included
      {
        version: 'ui@0.1.6',
        date: new Date(1508208094236).toISOString(),
      },
    ];

    const buckets = createReleaseBuckets(minTime, newEndingTs, releases);

    expect(buckets).toEqual([
      [
        1508208080000,
        0,
        1508208081424,
        3,
        [
          {version: 'ui@0.1.2', date: new Date(1508208080000).toISOString()},
          {version: 'ui@0.1.22', date: new Date(1508208081323).toISOString()},
          {version: 'ui@0.1.3', date: new Date(1508208081423).toISOString()},
        ],
      ],
      [1508208081424, 0, 1508208082848, 0, []],
      [1508208082848, 0, 1508208084272, 2, [expect.any(Object), expect.any(Object)]],
      [1508208084272, 0, 1508208085696, 0, []],
      [1508208085696, 0, 1508208087120, 0, []],
      [1508208087120, 0, 1508208088544, 0, []],
      [1508208088544, 0, 1508208089968, 0, []],
      [1508208089968, 0, 1508208091392, 0, []],
      [1508208091392, 0, 1508208092816, 0, []],
      [
        1508208092816,
        0,
        1508208094235,
        4,
        [
          {version: 'ui@0.1.51', date: new Date(1508208092816).toISOString()},
          {version: 'ui@0.1.52', date: new Date(1508208094230).toISOString()},
          {version: 'ui@0.1.53', date: new Date(1508208094235).toISOString()},
          {version: 'ui@0.1.54', date: new Date(1508208094235).toISOString()},
        ],
      ],
    ]);
  });
});
