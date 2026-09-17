import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {DataCategoryExact} from 'sentry/types/core';

import {CustomerStats} from 'admin/components/customers/customerStats';

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
