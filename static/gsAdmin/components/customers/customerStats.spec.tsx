import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {DataCategoryExact} from 'sentry/types/core';

import {CustomerStats, populateChartData} from 'admin/components/customers/customerStats';

describe('populateChartData', () => {
  const series = {
    accepted: {seriesName: 'Accepted', data: []},
    overQuota: {seriesName: 'Over Quota', data: []},
    totalFiltered: {seriesName: 'Filtered (Server)', data: []},
    totalDiscarded: {seriesName: 'Discarded (Client)', data: []},
    totalDropped: {seriesName: 'Dropped (Server)', data: []},
  };

  it('shows every custom inbound filter as one series without its id', () => {
    const intervals = ['2021-04-21T00:00:00Z', '2021-04-22T00:00:00Z'];
    const groups = [
      {
        by: {outcome: 'filtered', reason: 'custom-inbound-filter:1'},
        series: {'sum(quantity)': [1, 2]},
        totals: {'sum(quantity)': 3},
      },
      {
        by: {outcome: 'filtered', reason: 'custom-inbound-filter:2'},
        series: {'sum(quantity)': [10, 20]},
        totals: {'sum(quantity)': 30},
      },
      {
        by: {outcome: 'filtered', reason: 'Sampled:1000,1500'},
        series: {'sum(quantity)': [5, 5]},
        totals: {'sum(quantity)': 10},
      },
    ];

    const [, filtered] = populateChartData(intervals, groups, series);

    expect(filtered!.subSeries).toEqual([
      {
        seriesName: 'Custom Inbound Filter',
        data: [
          {name: intervals[0], value: 11},
          {name: intervals[1], value: 22},
        ],
      },
      {
        seriesName: 'Dynamic Sampling',
        data: [
          {name: intervals[0], value: 5},
          {name: intervals[1], value: 5},
        ],
      },
    ]);
    expect(filtered!.data.map(point => point.value)).toEqual([16, 27]);
  });
});

describe('CustomerStats', () => {
  const organization = OrganizationFixture();
  const statsUrl = `/organizations/${organization.slug}/stats_v2/`;
  let configState: ReturnType<typeof ConfigStore.getState>;

  beforeEach(() => {
    configState = ConfigStore.getState();
    // A non-UTC account timezone makes local-time parsing of the URL params visible.
    ConfigStore.loadInitialData({
      ...configState,
      user: {
        ...configState.user,
        options: {...configState.user.options, timezone: 'Europe/Vienna'},
      },
    });
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  function renderWithDateRange(query: Record<string, string>) {
    const statsMock = MockApiClient.addMockResponse({
      url: statsUrl,
      body: {
        intervals: ['2021-04-21T00:00:00Z', '2021-04-22T00:00:00Z'],
        groups: [
          {
            by: {outcome: 'accepted', reason: 'none'},
            series: {'sum(quantity)': [1, 2]},
            totals: {'sum(quantity)': 3},
          },
        ],
      },
    });

    render(
      <CustomerStats orgSlug={organization.slug} dataType={DataCategoryExact.SPAN} />,
      {
        initialRouterConfig: {
          location: {pathname: '/customers/org/', query},
        },
      }
    );

    return statsMock;
  }

  it('treats URL start and end as UTC when the utc flag is not set', async () => {
    const statsMock = renderWithDateRange({
      start: '2021-04-21T10:00:00',
      end: '2021-04-22T10:00:00',
    });

    expect(await screen.findByText('Total')).toBeInTheDocument();

    expect(statsMock).toHaveBeenCalledWith(
      statsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          start: '2021-04-21T10:00:00Z',
          end: '2021-04-22T10:00:00Z',
          utc: false,
        }),
      })
    );
  });

  it('treats URL start and end as UTC when the utc flag is set', async () => {
    const statsMock = renderWithDateRange({
      start: '2021-04-21T10:00:00',
      end: '2021-04-22T10:00:00',
      utc: 'true',
    });

    expect(await screen.findByText('Total')).toBeInTheDocument();

    expect(statsMock).toHaveBeenCalledWith(
      statsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          start: '2021-04-21T10:00:00Z',
          end: '2021-04-22T10:00:00Z',
          utc: true,
        }),
      })
    );
  });
});
