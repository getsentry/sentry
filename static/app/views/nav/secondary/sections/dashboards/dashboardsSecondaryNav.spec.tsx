import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {DashboardsSecondaryNav} from 'sentry/views/nav/secondary/sections/dashboards/dashboardsSecondaryNav';

describe('DashboardsSecondaryNav', () => {
  let organization: Organization;

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['dashboards-starred-reordering'],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/starred/`,
      body: [
        DashboardListItemFixture({
          id: '9999',
          title: 'Dashboard 9999',
        }),
        DashboardListItemFixture({
          id: '1',
          title: 'Dashboard 1',
        }),
      ],
    });
  });

  it('should render dashboards in order of response', async () => {
    render(<DashboardsSecondaryNav />, {organization});

    expect(await screen.findByText('Dashboard 9999')).toBeInTheDocument();

    expect(screen.getAllByRole('link').map(el => el.textContent)).toEqual([
      'All Dashboards',
      'Dashboard 9999',
      'Dashboard 1',
    ]);
  });
});
