import type {StatsGroup} from 'admin/components/customers/customerStats';

interface Response {
  end: string;
  groups: StatsGroup[];
  intervals: (string | number)[];
  start: string;
}

export function StatsBillingPeriodFixture(): Response {
  return {
    start: '2021-06-29T00:00:00Z',
    end: '2021-07-20T20:12:00Z',
    intervals: [
      '2021-06-29T00:00:00Z',
      '2021-06-30T00:00:00Z',
      '2021-07-01T00:00:00Z',
      '2021-07-02T00:00:00Z',
      '2021-07-03T00:00:00Z',
      '2021-07-04T00:00:00Z',
      '2021-07-05T00:00:00Z',
      '2021-07-06T00:00:00Z',
      '2021-07-07T00:00:00Z',
      '2021-07-08T00:00:00Z',
      '2021-07-09T00:00:00Z',
      '2021-07-10T00:00:00Z',
      '2021-07-11T00:00:00Z',
      '2021-07-12T00:00:00Z',
      '2021-07-13T00:00:00Z',
      '2021-07-14T00:00:00Z',
      '2021-07-15T00:00:00Z',
      '2021-07-16T00:00:00Z',
      '2021-07-17T00:00:00Z',
      '2021-07-18T00:00:00Z',
      '2021-07-19T00:00:00Z',
      '2021-07-20T00:00:00Z',
    ],
    groups: [
      {
        by: {
          outcome: 'filtered',
          reason: 'none',
        },
        totals: {
          'sum(quantity)': 4000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 500, 500, 500, 500, 500, 500, 500, 500,
            0,
          ],
        },
      },
      {
        by: {
          outcome: 'filtered',
          reason: 'browser-extensions',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'filtered',
          reason: 'Sampled:3',
        },
        totals: {
          'sum(quantity)': 3558,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3558, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'filtered',
          reason: 'Sampled:4',
        },
        totals: {
          'sum(quantity)': 1404,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1404, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'rate_limited',
          reason: 'grace_period',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'rate_limited',
          reason: 'browser-extensions',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'invalid',
          reason: 'legacy-browsers',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'error-message',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'invalid',
          reason: 'cors',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'project_abuse_limit',
          outcome: 'rate_limited',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'localhost',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'accepted',
          reason: 'none',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'rate_limited',
          reason: 'usage_exceeded',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'web-crawlers',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
    ],
  };
}
