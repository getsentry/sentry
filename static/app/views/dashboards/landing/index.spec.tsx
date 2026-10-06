import {DashboardFixture, DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {WidgetFixture} from 'sentry-fixture/widget';

import {act, render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import DashboardsLanding from 'sentry/views/dashboards/landing';
import {WidgetType} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

describe('DashboardsLanding', () => {
  const organization = OrganizationFixture({
    features: ['dashboards-basic', 'dashboards-edit'],
  });

  beforeEach(() => {
    act(() =>
      ProjectsStore.loadInitialData([
        ProjectFixture({id: '7', platform: 'javascript-nextjs', isMember: true}),
      ])
    );

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        DashboardListItemFixture({
          id: '10',
          title: 'Next.js Overview',
          prebuiltId: PrebuiltDashboardId.NEXTJS_FRONTEND_OVERVIEW,
        }),
        DashboardListItemFixture({
          id: '12',
          title: 'Storefront',
          projects: [7],
          isFavorited: true,
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/12/',
      body: DashboardFixture([WidgetFixture({widgetType: WidgetType.ERRORS})], {
        id: '12',
        title: 'Storefront',
      }),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('groups dashboards into boxes', async () => {
    render(<DashboardsLanding />, {organization});

    const starred = await screen.findByTestId('landing-section-starred');
    expect(within(starred).getByText('Storefront')).toBeInTheDocument();

    const recommended = screen.getByTestId('landing-section-recommended');
    expect(within(recommended).getByText('Next.js Overview')).toBeInTheDocument();
    expect(
      within(recommended).getByText('For your Next.js projects')
    ).toBeInTheDocument();

    const nextjs = screen.getByTestId('landing-section-framework-nextjs');
    expect(within(nextjs).getByText('Storefront')).toBeInTheDocument();

    // Custom dashboard data sources come from the widget details request.
    const errors = screen.getByTestId('landing-section-errors');
    expect(await within(errors).findByText('Storefront')).toBeInTheDocument();
  });
});
