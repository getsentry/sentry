import {ProjectFixture} from 'sentry-fixture/project';

import {addMetricsDataMock} from 'sentry-test/performance/addMetricsDataMock';
import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {generatePerformanceEventView} from 'sentry/views/performance/data';
import {PerformanceLanding} from 'sentry/views/performance/landing';

function WrappedComponent({
  data,
  withStaticFilters = true,
}: {
  data: any;
  withStaticFilters?: boolean;
}) {
  const eventView = generatePerformanceEventView(
    data.router.location,
    data.projects,
    {
      withStaticFilters,
    },
    data.organization
  );

  return (
    <MetricsCardinalityProvider
      location={data.router.location}
      organization={data.organization}
    >
      <PerformanceLanding
        router={data.router}
        organization={data.organization}
        location={data.router.location}
        eventView={eventView}
        projects={data.projects}
        selection={eventView.getPageFilters()}
        onboardingProject={undefined}
        handleSearch={() => {}}
        handleTrendsClick={() => {}}
        setError={() => {}}
        withStaticFilters={withStaticFilters}
      />
    </MetricsCardinalityProvider>
  );
}

const features = [
  'performance-transaction-name-only-search',
  'organizations:performance-transaction-name-only-search',
];

describe('Performance > Landing > MetricsDataSwitcher', function () {
  let wrapper: any;

  act(() => void TeamStore.loadInitialData([], false, null));
  beforeEach(function () {
    jest.spyOn(console, 'error').mockImplementation(jest.fn());

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/legacy-key-transactions-count/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-trends-stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-histogram/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/eventsv2/`,
      body: {
        meta: {
          id: 'string',
        },
        data: [
          {
            id: '1234',
          },
        ],
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();

    if (wrapper) {
      wrapper.unmount();
      wrapper = undefined;
    }
  });

  it('renders basic UI elements', function () {
    addMetricsDataMock();
    const project = ProjectFixture();
    const data = initializeData({
      project: project.id,
      projects: [project],
      features,
    });

    wrapper = render(<WrappedComponent data={data} />, {organization: data.organization});
    expect(screen.getByTestId('performance-landing-v3')).toBeInTheDocument();
  });

  it('renders with feature flag and all metric data', async function () {
    addMetricsDataMock();
    const project = ProjectFixture();
    const data = initializeData({
      project: project.id,
      projects: [project],
      features,
    });

    wrapper = render(<WrappedComponent data={data} />, {organization: data.organization});

    expect(await screen.findByTestId('transaction-search-bar')).toBeInTheDocument();
  });

  it('renders with feature flag and checking dynamic sampled projects exist', async function () {
    addMetricsDataMock({
      metricsCount: 100,
      nullCount: 0,
      unparamCount: 0,
    });
    const project = ProjectFixture();
    const data = initializeData({
      project: project.id,
      projects: [project],
      features,
    });

    wrapper = render(<WrappedComponent data={data} />, {organization: data.organization});

    expect(await screen.findByTestId('transaction-search-bar')).toBeInTheDocument();
  });

  it('renders with feature flag and any incompatible data', async function () {
    addMetricsDataMock({
      metricsCount: 100,
      nullCount: 1,
      unparamCount: 0,
    });
    const project = ProjectFixture();
    const data = initializeData({
      project: project.id,
      projects: [project],
      features,
    });

    wrapper = render(<WrappedComponent data={data} />, {organization: data.organization});
    expect(await screen.findByTestId('transaction-search-bar')).toBeInTheDocument();
    expect(
      await screen.findByTestId('landing-mep-alert-single-project-incompatible')
    ).toBeInTheDocument();
  });

  it('renders with feature flag and any incompatible transactions on multiple projects with at least one compatible project', async function () {
    addMetricsDataMock({
      metricsCount: 100,
      nullCount: 1,
      unparamCount: 0,
      compatibleProjects: [1],
    });
    const project = ProjectFixture({id: '1'});
    const project2 = ProjectFixture({id: '2'});
    const data = initializeData({
      project: '-1',
      projects: [project, project2],
      features,
    });

    wrapper = render(<WrappedComponent data={data} />, {organization: data.organization});
    expect(await screen.findByTestId('transaction-search-bar')).toBeInTheDocument();
    expect(
      await screen.findByTestId('landing-mep-alert-multi-project-incompatible')
    ).toBeInTheDocument();
  });

  it('renders with feature flag and any incompatible transactions on multiple projects with no compatible project', async function () {
    addMetricsDataMock({
      metricsCount: 100,
      nullCount: 1,
      unparamCount: 0,
      compatibleProjects: [],
    });
    const project = ProjectFixture({id: '1'});
    const project2 = ProjectFixture({id: '2'});
    const data = initializeData({
      project: '-1',
      projects: [project, project2],
      features,
    });

    wrapper = render(<WrappedComponent data={data} />, {organization: data.organization});
    expect(await screen.findByTestId('transaction-search-bar')).toBeInTheDocument();
    expect(
      await screen.findByTestId('landing-mep-alert-multi-project-all-incompatible')
    ).toBeInTheDocument();
  });

  it('renders with feature flag and all other(unparam) transactions', async function () {
    addMetricsDataMock({
      metricsCount: 100,
      nullCount: 0,
      unparamCount: 100,
    });
    const project = ProjectFixture();
    const data = initializeData({
      project: project.id,
      projects: [project],
      features,
    });

    wrapper = render(<WrappedComponent data={data} />, {organization: data.organization});
    expect(await screen.findByTestId('transaction-search-bar')).toBeInTheDocument();
    expect(
      await screen.findByTestId('landing-mep-alert-unnamed-discover')
    ).toBeInTheDocument();
  });

  it('renders with feature flag and partial other(unparam) transactions and platform with docs', async function () {
    addMetricsDataMock({
      metricsCount: 100,
      nullCount: 0,
      unparamCount: 1,
    });
    const project = ProjectFixture({platform: 'javascript-react'});
    const data = initializeData({
      project: project.id,
      projects: [project],
      features,
    });

    wrapper = render(<WrappedComponent data={data} />, {organization: data.organization});
    expect(await screen.findByTestId('transaction-search-bar')).toBeInTheDocument();
    expect(
      await screen.findByTestId('landing-mep-alert-unnamed-discover-or-set')
    ).toBeInTheDocument();
  });

  it('renders with feature flag and partial other(unparam) transactions', async function () {
    addMetricsDataMock({
      metricsCount: 100,
      nullCount: 0,
      unparamCount: 1,
    });
    const project = ProjectFixture();
    const data = initializeData({
      project: project.id,
      projects: [project],
      features,
    });

    wrapper = render(<WrappedComponent data={data} />, {organization: data.organization});
    expect(await screen.findByTestId('transaction-search-bar')).toBeInTheDocument();
    expect(
      await screen.findByTestId('landing-mep-alert-unnamed-discover')
    ).toBeInTheDocument();
  });
});
