import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFilters} from 'sentry/types';
import OrganizationStats from 'sentry/views/organizationStats';

describe('OrganizationStats', function () {
  const defaultSelection: PageFilters = {
    projects: [],
    environments: [],
    datetime: {
      start: null,
      end: null,
      period: '24h',
      utc: false,
    },
  };

  const {organization, routerContext} = initializeOrg();
  organization.features.push('team-insights');

  beforeEach(() => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/stats_v2/`,
      body: mockStatsResponse,
    });
  });

  it('renders with default state', async () => {
    render(
      <OrganizationStats selection={defaultSelection} organization={organization} />,
      {
        context: routerContext,
        organization,
      }
    );
    await tick();

    await screen.findByText('');
    screen.debug();
  });
});

const mockStatsResponse = {
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
    {
      by: {
        category: 'error',
        outcome: 'filtered',
      },
      totals: {
        'sum(quantity)': 7,
      },
      series: {
        'sum(quantity)': [1, 1, 1, 1, 1, 1, 1],
      },
    },
    {
      by: {
        category: 'error',
        outcome: 'rate_limited',
      },
      totals: {
        'sum(quantity)': 14,
      },
      series: {
        'sum(quantity)': [2, 2, 2, 2, 2, 2, 2],
      },
    },
    {
      by: {
        category: 'error',
        outcome: 'invalid',
      },
      totals: {
        'sum(quantity)': 15,
      },
      series: {
        'sum(quantity)': [2, 2, 2, 2, 2, 2, 3],
      },
    },
    {
      by: {
        category: 'error',
        outcome: 'client_discard',
      },
      totals: {
        'sum(quantity)': 15,
      },
      series: {
        'sum(quantity)': [2, 2, 2, 2, 2, 2, 3],
      },
    },
  ],
};
