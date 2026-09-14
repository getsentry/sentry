import type {PageFilterDatetime} from 'sentry/types/core';

import {getAgentChartInterval} from './agentsCharts';

describe('getAgentChartInterval', () => {
  it.each([
    ['30m', '1m'],
    ['1h', '5m'],
    ['6h', '30m'],
    ['24h', '1h'],
    ['2d', '6h'],
    ['7d', '1d'],
    ['30d', '1d'],
  ])('uses %s range with %s buckets', (period, expectedInterval) => {
    const datetime: PageFilterDatetime = {
      period,
      start: null,
      end: null,
      utc: false,
    };

    expect(getAgentChartInterval(datetime)).toBe(expectedInterval);
  });
});
