import type {ReactNode} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {FeatureFlagOverrides} from 'sentry/utils/featureFlagOverrides';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {MAX_PERIOD_FOR_CROSS_EVENTS} from 'sentry/views/explore/constants';
import {TopBar} from 'sentry/views/navigation/topBar';

import {ExploreContent} from './content';

function TopBarWrapper({children}: {children: ReactNode}) {
  return (
    <TopBar.Slot.Provider>
      <TopBar.Slot.Outlet name="breadcrumbs">
        {props => <div {...props} data-test-id="topbar-breadcrumbs-slot" />}
      </TopBar.Slot.Outlet>
      {/* Mirror the real TopBar, which renders the title slot as an <h1>. */}
      <TopBar.Slot.Outlet name="title">
        {props => <h1 {...props} data-test-id="topbar-title-slot" />}
      </TopBar.Slot.Outlet>
      {children}
    </TopBar.Slot.Provider>
  );
}

describe('ExploreContent', () => {
  const {organization, project} = initializeOrg({
    organization: {
      features: ['gen-ai-features'],
    },
  });
  const {organization: highRangeOrganization, project: highRangeProject} = initializeOrg({
    organization: {
      slug: 'high-range-org',
      features: ['gen-ai-features', 'visibility-explore-range-high'],
    },
  });

  function addExploreMockResponses({
    organizationBody,
    projectBody,
  }: {
    organizationBody: Organization;
    projectBody: typeof project;
  }) {
    const organizationSlug = organizationBody.slug;
    MockApiClient.addMockResponse({
      url: `/projects/${organizationSlug}/${projectBody.slug}/`,
      body: projectBody,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organizationSlug}/${projectBody.slug}/keys/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/sdks/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/stats_v2/`,
      body: {groups: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/trace-items/attributes/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/events/validate/`,
      body: {
        dataset: [],
        environment: [],
        field: [],
        orderby: [],
        projects: [],
        query: {error: null, fields: [], valid: true},
        valid: true,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/seer/setup-check/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/`,
      method: 'GET',
      body: organizationBody,
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organizationSlug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/recent-searches/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/spans/fields/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/events/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/traces/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
      match: [MockApiClient.matchQuery({attributeType: 'number'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {
          key: 'project',
          name: 'project',
          attributeSource: {source_type: 'sentry'},
        },
      ],
      match: [MockApiClient.matchQuery({attributeType: 'string'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/projects/`,
      method: 'GET',
      body: [projectBody],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/explore/saved/`,
      method: 'GET',
      body: [],
    });
  }

  beforeEach(() => {
    FeatureFlagOverrides.singleton().clear();
    PageFiltersStore.init();
    OrganizationStore.onUpdate(organization, {replace: true});

    addExploreMockResponses({
      organizationBody: organization,
      projectBody: project,
    });
    addExploreMockResponses({
      organizationBody: highRangeOrganization,
      projectBody: highRangeProject,
    });
    MockApiClient.addMockResponse({
      url: '/assistant/',
      method: 'GET',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    FeatureFlagOverrides.singleton().clear();
    act(() => {
      OrganizationStore.reset();
      ProjectsStore.reset();
    });
    jest.clearAllMocks();
  });

  it('preserves shared 90 day span links', async () => {
    act(() => ProjectsStore.loadInitialData([highRangeProject]));
    OrganizationStore.onUpdate(highRangeOrganization, {replace: true});

    render(<ExploreContent />, {
      organization: highRangeOrganization,
      additionalWrapper: TopBarWrapper,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${highRangeOrganization.slug}/explore/traces/`,
          query: {statsPeriod: '90d'},
        },
      },
    });

    await screen.findByText('Traces');

    await waitFor(() =>
      expect(PageFiltersStore.getState().selection.datetime).toEqual({
        period: '90d',
        start: null,
        end: null,
        utc: null,
      })
    );
  });

  it('waits for organization loading before initializing shared date ranges', async () => {
    act(() => ProjectsStore.loadInitialData([highRangeProject]));
    OrganizationStore.reset();

    const highRangeOrganizationWithoutFeature = {
      ...highRangeOrganization,
      features: ['gen-ai-features'],
    };

    const {rerender} = render(
      <OrganizationContext value={highRangeOrganizationWithoutFeature}>
        <ExploreContent />
      </OrganizationContext>,
      {
        organization: highRangeOrganizationWithoutFeature,
        additionalWrapper: TopBarWrapper,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${highRangeOrganization.slug}/explore/traces/`,
            query: {statsPeriod: '90d'},
          },
        },
      }
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(
      screen.queryByTestId('page-filter-timerange-selector')
    ).not.toBeInTheDocument();

    act(() => OrganizationStore.onUpdate(highRangeOrganization, {replace: true}));
    rerender(
      <OrganizationContext value={highRangeOrganization}>
        <ExploreContent />
      </OrganizationContext>
    );

    await screen.findByText('Traces');

    await waitFor(() =>
      expect(PageFiltersStore.getState().selection.datetime).toEqual({
        period: '90d',
        start: null,
        end: null,
        utc: null,
      })
    );
  });

  it('clamps shared 90 day span links for 30 day users', async () => {
    act(() => ProjectsStore.loadInitialData([project]));

    render(<ExploreContent />, {
      organization,
      additionalWrapper: TopBarWrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/',
          query: {statsPeriod: '90d'},
        },
      },
    });

    await screen.findByText('Traces');

    await waitFor(() =>
      expect(PageFiltersStore.getState().selection.datetime).toEqual({
        period: '30d',
        start: null,
        end: null,
        utc: null,
      })
    );
  });

  it('does not keep loading when toolbar overrides disable the high range flag', async () => {
    act(() => ProjectsStore.loadInitialData([highRangeProject]));
    FeatureFlagOverrides.singleton().setStoredOverride(
      'visibility-explore-range-high',
      false
    );

    const highRangeOrganizationWithOverride = {
      ...highRangeOrganization,
      features: ['gen-ai-features'],
    };
    OrganizationStore.onUpdate(highRangeOrganizationWithOverride, {replace: true});

    render(<ExploreContent />, {
      organization: highRangeOrganizationWithOverride,
      additionalWrapper: TopBarWrapper,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${highRangeOrganization.slug}/explore/traces/`,
          query: {statsPeriod: '90d'},
        },
      },
    });

    await screen.findByText('Traces');

    await waitFor(() =>
      expect(PageFiltersStore.getState().selection.datetime).toEqual({
        period: '30d',
        start: null,
        end: null,
        utc: null,
      })
    );
  });

  describe('cross events', () => {
    it('renders with cross events', async () => {
      PageFiltersStore.onInitializeUrlState({
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {period: '7d', start: null, end: null, utc: null},
      });

      render(<ExploreContent />, {
        organization,
        additionalWrapper: TopBarWrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              crossEvents: JSON.stringify([{query: '', type: 'spans'}]),
            },
          },
        },
      });

      // Component renders successfully with cross events
      expect(await screen.findByText('Traces')).toBeInTheDocument();

      // The add cross event button should be visible
      expect(
        screen.getByRole('button', {name: 'Add a cross event query'})
      ).toBeInTheDocument();
    });

    it('resets period when maxDateRange is applied after cross events are added', async () => {
      PageFiltersStore.onInitializeUrlState({
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      });

      const {router} = render(<ExploreContent />, {
        organization,
        additionalWrapper: TopBarWrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              statsPeriod: '14d',
            },
          },
        },
      });

      await screen.findByText('Traces');

      await waitFor(() =>
        expect(PageFiltersStore.getState().selection.datetime).toEqual({
          period: '14d',
          start: null,
          end: null,
          utc: null,
        })
      );

      act(() => {
        router.navigate({
          pathname: '/organizations/org-slug/explore/traces/',
          search: `statsPeriod=14d&crossEvents=${encodeURIComponent(
            JSON.stringify([{query: '', type: 'spans'}])
          )}`,
        });
      });

      await waitFor(() =>
        expect(PageFiltersStore.getState().selection.datetime).toEqual({
          period: MAX_PERIOD_FOR_CROSS_EVENTS,
          start: null,
          end: null,
          utc: null,
        })
      );
    });
  });
});
