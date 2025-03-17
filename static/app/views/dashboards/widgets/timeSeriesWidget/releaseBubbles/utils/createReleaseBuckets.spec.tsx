import {createReleaseBuckets} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/utils/createReleaseBuckets';

describe('createReleaseBuckets', () => {
  const now = Date.now();
  it.each([
    [now, now, 10, 0],
    [undefined, now, 10, 0],
    [now, undefined, 10, 0],
    [now, now + 1000, 10, 10],
    [now, now + 1000, 20, 20],
  ])(
    'creates correct # of buckets for timeSeries with [min, max] of [%d, %d] and %d desired buckets',
    (minTime, maxTime, desiredBuckets, expectedBuckets) => {
      const buckets = createReleaseBuckets(minTime, maxTime, [], desiredBuckets);
      expect(buckets).toHaveLength(expectedBuckets);
    }
  );

  it('creates the correct buckets', () => {
    const minTime = Date.now();
    const maxTime = Date.now() + 12 * 1000 + 2235;

    const buckets = createReleaseBuckets(minTime, maxTime, []);
    expect(buckets).toEqual([
      {start: 1508208080000, end: 1508208081424, releases: []},
      {start: 1508208081424, end: 1508208082848, releases: []},
      {start: 1508208082848, end: 1508208084272, releases: []},
      {start: 1508208084272, end: 1508208085696, releases: []},
      {start: 1508208085696, end: 1508208087120, releases: []},
      {start: 1508208087120, end: 1508208088544, releases: []},
      {start: 1508208088544, end: 1508208089968, releases: []},
      {start: 1508208089968, end: 1508208091392, releases: []},
      {start: 1508208091392, end: 1508208092816, releases: []},
      {start: 1508208092816, end: 1508208094235, releases: []},
    ]);
  });

  it('buckets releases correctly', () => {
    const minTime = Date.now();
    const maxTime = Date.now() + 12 * 1000 + 2235;

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

    const buckets = createReleaseBuckets(minTime, maxTime, releases);

    expect(buckets).toEqual([
      {
        start: 1508208080000,
        end: 1508208081424,
        releases: [
          {version: 'ui@0.1.2', date: new Date(1508208080000).toISOString()},
          {version: 'ui@0.1.22', date: new Date(1508208081323).toISOString()},
          {version: 'ui@0.1.3', date: new Date(1508208081423).toISOString()},
        ],
      },
      {start: 1508208081424, end: 1508208082848, releases: []},
      {
        start: 1508208082848,
        end: 1508208084272,
        releases: [expect.any(Object), expect.any(Object)],
      },
      {start: 1508208084272, end: 1508208085696, releases: []},
      {start: 1508208085696, end: 1508208087120, releases: []},
      {start: 1508208087120, end: 1508208088544, releases: []},
      {start: 1508208088544, end: 1508208089968, releases: []},
      {start: 1508208089968, end: 1508208091392, releases: []},
      {start: 1508208091392, end: 1508208092816, releases: []},
      {
        start: 1508208092816,
        end: 1508208094235,
        releases: [
          {version: 'ui@0.1.51', date: new Date(1508208092816).toISOString()},
          {version: 'ui@0.1.52', date: new Date(1508208094230).toISOString()},
          {version: 'ui@0.1.53', date: new Date(1508208094235).toISOString()},
          {version: 'ui@0.1.54', date: new Date(1508208094235).toISOString()},
        ],
      },
    ]);
  });
});
