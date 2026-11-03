import {ThemeFixture} from 'sentry-fixture/theme';

import type {UsageSeries} from 'sentry/views/organizationStats/types';
import {formatData} from 'sentry/views/settings/project/projectFilters/projectFiltersChart';

const theme = ThemeFixture();

function usageSeries(groups: Array<[reason: string, values: number[]]>): UsageSeries {
  return {
    start: '2026-10-01T00:00:00Z',
    end: '2026-10-03T00:00:00Z',
    intervals: ['2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'],
    groups: groups.map(([reason, values]) => ({
      by: {reason},
      totals: {},
      series: {'sum(quantity)': values},
    })),
  };
}

describe('ProjectFiltersChart formatData', () => {
  it('orders the series by total so colors do not depend on the response order', () => {
    const groups: Array<[string, number[]]> = [
      ['browser-extensions', [1, 2]],
      ['error-message', [10, 20]],
      ['legacy-browsers', [5, 5]],
    ];

    const forward = formatData(usageSeries(groups), theme);
    const reversed = formatData(usageSeries([...groups].reverse()), theme);

    expect(reversed).toEqual(forward);
    expect(forward.map(series => series.seriesName)).toEqual([
      'Error Message',
      'Legacy Browsers',
      'Browser Extensions',
    ]);
    expect(new Set(forward.map(series => series.color)).size).toBe(3);
  });

  it('breaks a tie on the series name', () => {
    const groups: Array<[string, number[]]> = [
      ['legacy-browsers', [1, 1]],
      ['browser-extensions', [2, 0]],
    ];

    const forward = formatData(usageSeries(groups), theme);
    const reversed = formatData(usageSeries([...groups].reverse()), theme);

    expect(reversed).toEqual(forward);
    expect(forward.map(series => series.seriesName)).toEqual([
      'Browser Extensions',
      'Legacy Browsers',
    ]);
  });
});
