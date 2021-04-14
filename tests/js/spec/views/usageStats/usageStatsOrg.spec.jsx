import React from 'react';
import moment from 'moment';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {DataCategory} from 'app/types';
import UsageStatsOrg from 'app/views/usageStats/usageStatsOrg';

export const mockData = {
  start: '2021-01-01T00:00:00Z',
  end: '2021-01-07T00:00:00Z',
  intervals: [
    '2021-01-01T00:00:00Z',
    '2021-01-02T00:00:00Z',
    '2021-01-03T00:00:00Z',
    '2021-01-04T00:00:00Z',
    '2021-01-05T00:00:00Z',
    '2021-01-06T00:00:00Z',
    '2021-01-07T00:00:00Z',
  ],
  groups: [
    {
      by: {
        category: 'attachment',
        outcome: 'accepted',
      },
      totals: {
        'sum(quantity)': 28000,
      },
      series: {
        'sum(quantity)': [1000, 2000, 3000, 4000, 5000, 6000, 7000],
      },
    },
    {
      by: {
        outcome: 'accepted',
        category: 'transaction',
      },
      totals: {
        'sum(quantity)': 28,
      },
      series: {
        'sum(quantity)': [1, 2, 3, 4, 5, 6, 7],
      },
    },
    {
      by: {
        category: 'error',
        outcome: 'accepted',
      },
      totals: {
        'sum(quantity)': 28,
      },
      series: {
        'sum(quantity)': [1, 2, 3, 4, 5, 6, 7],
      },
    },
  ],
};

describe('UsageStatsOrg', function () {
  const {organization, routerContext} = initializeOrg();
  const orgSlug = organization.slug;
  const orgUrl = `/organizations/${orgSlug}/stats_v2/`;
  const dateStart = moment(new Date(2021, 1, 1));
  const dateEnd = moment(new Date(2021, 1, 8));

  let mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mock = MockApiClient.addMockResponse({
      url: orgUrl,
      body: mockData,
    });
  });

  it('load stats for Organizations', async function () {
    const wrapper = mountWithTheme(
      <UsageStatsOrg
        organization={organization}
        dataCategory={DataCategory.ERRORS}
        dataCategoryName="Errors"
        dateStart={dateStart}
        dateEnd={dateEnd}
        onChangeDataCategory={() => {}}
        onChangeDateRange={() => {}}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: '7d',
          interval: '1d',
          groupBy: ['category', 'outcome'],
          field: ['sum(quantity)'],
        },
      })
    );
  });
});
