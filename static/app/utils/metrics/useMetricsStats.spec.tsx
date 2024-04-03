import type {PageFilters} from 'sentry/types';

import {convertToStatsResponse, getMetricsStatsRequest} from './useMetricsStats';

describe('getMetricsStatsRequest', () => {
  it('should create a metrics query request', () => {
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {period: '7d', utc: true} as PageFilters['datetime'],
    };

    expect(getMetricsStatsRequest(filters)).toEqual({
      query: {
        statsPeriod: '7d',
        project: [1],
        environment: ['production'],
        interval: '30m',
      },
      body: {
        queries: [
          {
            mql: 'sum(c:metric_stats/volume@none) by (outcome.id)',
            name: 'query_1',
          },
        ],
        formulas: [{limit: undefined, mql: '$query_1', order: undefined}],
      },
    });
  });
});

describe('convertToStatsResponse', () => {
  it('should convert a metrics query response to a usage series', () => {
    const response = {
      data: [
        [
          {
            by: {
              'outcome.id': '0',
            },
            totals: 587540585,
            series: [433581389, 153959196],
          },
        ],
      ],
      meta: [],
      start: '2024-04-02T14:00:00Z',
      end: '2024-04-02T16:00:00Z',
      intervals: ['2024-04-02T14:00:00Z', '2024-04-02T15:00:00Z'],
    };

    expect(convertToStatsResponse(response)).toEqual({
      groups: [
        {
          by: {
            outcome: 'accepted',
          },
          series: {
            'sum(quantity)': [433581389, 153959196],
          },
          totals: {
            'sum(quantity)': 587540585,
          },
        },
      ],
      start: '2024-04-02T14:00:00Z',
      end: '2024-04-02T16:00:00Z',
      intervals: ['2024-04-02T14:00:00Z', '2024-04-02T15:00:00Z'],
    });
  });
});
