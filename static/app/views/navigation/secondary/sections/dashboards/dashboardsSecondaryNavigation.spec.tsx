import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {DashboardsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsSecondaryNavigation';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

describe('DashboardsSecondaryNavigation', () => {
  let organization: Organization;

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['dashboards-prebuilt-insights-dashboards'],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/starred/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      body: [
        DashboardListItemFixture({id: '9999', title: 'Dashboard 9999'}),
        DashboardListItemFixture({id: '1', title: 'Dashboard 1'}),
      ],
      match: [MockApiClient.matchQuery({filter: 'onlyFavorites'})],
    });
  });

  it('should render dashboards in order of response', async () => {
    render(
      <SecondaryNavigationContextProvider>
        <DashboardsSecondaryNavigation />
      </SecondaryNavigationContextProvider>,
      {organization}
    );

    expect(await screen.findByText('Dashboard 9999')).toBeInTheDocument();

    expect(screen.getAllByRole('link').map(el => el.textContent)).toEqual([
      'All Dashboards',
      'Sentry Built',
      'Custom Dashboards',
      'Dashboard 9999',
      'Dashboard 1',
    ]);
  });

  it('links the Custom Dashboards tab to the custom-only filter', async () => {
    render(
      <SecondaryNavigationContextProvider>
        <DashboardsSecondaryNavigation />
      </SecondaryNavigationContextProvider>,
      {organization}
    );

    expect(await screen.findByRole('link', {name: 'Custom Dashboards'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/?filter=excludePrebuilt'
    );
  });

  it('only renders the All Dashboards tab without prebuilt dashboards', async () => {
    render(
      <SecondaryNavigationContextProvider>
        <DashboardsSecondaryNavigation />
      </SecondaryNavigationContextProvider>,
      {organization: OrganizationFixture()}
    );

    expect(await screen.findByRole('link', {name: 'All Dashboards'})).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Custom Dashboards'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Sentry Built'})).not.toBeInTheDocument();
  });

  it('renders a reorderable starred list when dashboards-starred is enabled', async () => {
    const starredOrganization = OrganizationFixture({
      features: ['dashboards-prebuilt-insights-dashboards', 'dashboards-starred'],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${starredOrganization.slug}/dashboards/starred/`,
      body: [
        DashboardListItemFixture({id: '9999', title: 'Dashboard 9999'}),
        DashboardListItemFixture({id: '1', title: 'Dashboard 1'}),
      ],
    });

    render(
      <SecondaryNavigationContextProvider>
        <DashboardsSecondaryNavigation />
      </SecondaryNavigationContextProvider>,
      {organization: starredOrganization}
    );

    expect(await screen.findByText('Dashboard 9999')).toBeInTheDocument();
    expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Drag to reorder'})).toHaveLength(2);
  });
});
