import {browserHistory} from 'react-router';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {addMetricsDataMock} from 'sentry-test/performance/addMetricsDataMock';
import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {generatePerformanceEventView} from 'sentry/views/performance/data';
import {PerformanceLanding} from 'sentry/views/performance/landing';
import {REACT_NATIVE_COLUMN_TITLES} from 'sentry/views/performance/landing/data';
import {LandingDisplayField} from 'sentry/views/performance/landing/utils';

const searchHandlerMock = jest.fn();

const WrappedComponent = ({data, withStaticFilters = false}) => {
  const eventView = generatePerformanceEventView(
    data.router.location,
    data.projects,
    {
      withStaticFilters,
    },
    data.organization
  );

  const client = new QueryClient();

  return (
    <QueryClientProvider client={client}>
      <OrganizationContext.Provider value={data.organization}>
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
            handleSearch={searchHandlerMock}
            handleTrendsClick={() => {}}
            setError={() => {}}
            withStaticFilters={withStaticFilters}
          />
        </MetricsCardinalityProvider>
      </OrganizationContext.Provider>
    </QueryClientProvider>
  );
};

describe('Performance > Landing > Index', function () {
  let eventStatsMock: jest.Mock;
  let eventsMock: jest.Mock;
  let wrapper: any;

  act(() => void TeamStore.loadInitialData([], false, null));
  beforeEach(function () {
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn());

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
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
    eventStatsMock = MockApiClient.addMockResponse({
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
    eventsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events/`,
      body: {
        meta: {
          fields: {
            id: 'string',
          },
        },
        data: [
          {
            id: '1234',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics-compatibility/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics-compatibility-sums/`,
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    jest.restoreAllMocks();

    if (wrapper) {
      wrapper.unmount();
      wrapper = undefined;
    }
  });

  it('renders basic UI elements', function () {
    const data = initializeData();

    wrapper = render(<WrappedComponent data={data} />, data.routerContext);

    expect(screen.getByTestId('performance-landing-v3')).toBeInTheDocument();
  });

  it('renders frontend pageload view', function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.FRONTEND_PAGELOAD},
    });

    wrapper = render(<WrappedComponent data={data} />, data.routerContext);

    expect(screen.getByTestId('frontend-pageload-view')).toBeInTheDocument();
    expect(screen.getByTestId('performance-table')).toBeInTheDocument();

    const titles = screen.getAllByTestId('performance-widget-title');
    expect(titles).toHaveLength(5);

    expect(titles[0]).toHaveTextContent('Worst LCP Web Vitals');
    expect(titles[1]).toHaveTextContent('Worst FCP Web Vitals');
    expect(titles[2]).toHaveTextContent('p75 LCP');
    expect(titles[3]).toHaveTextContent('LCP Distribution');
    expect(titles[4]).toHaveTextContent('FCP Distribution');
  });

  it('renders frontend other view', function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.FRONTEND_OTHER},
    });

    wrapper = render(<WrappedComponent data={data} />, data.routerContext);
    expect(screen.getByTestId('performance-table')).toBeInTheDocument();
  });

  it('renders backend view', function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.BACKEND},
    });

    wrapper = render(<WrappedComponent data={data} />, data.routerContext);
    expect(screen.getByTestId('performance-table')).toBeInTheDocument();
  });

  it('renders mobile view', function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.MOBILE},
    });

    wrapper = render(<WrappedComponent data={data} />, data.routerContext);
    expect(screen.getByTestId('performance-table')).toBeInTheDocument();
  });

  it('renders react-native table headers in mobile view', async function () {
    const project = TestStubs.Project({platform: 'react-native'});
    const projects = [project];
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.MOBILE},
      selectedProject: project.id,
      projects,
    });

    wrapper = render(<WrappedComponent data={data} />, data.routerContext);

    expect(await screen.findByTestId('performance-table')).toBeInTheDocument();
    expect(screen.getByTestId('grid-editable')).toBeInTheDocument();
    const columnHeaders = await screen.findAllByTestId('grid-head-cell');

    expect(columnHeaders).toHaveLength(REACT_NATIVE_COLUMN_TITLES.length);
    for (const [index, title] of columnHeaders.entries()) {
      expect(title).toHaveTextContent(REACT_NATIVE_COLUMN_TITLES[index]);
    }
  });

  it('renders all transactions view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.ALL},
    });

    wrapper = render(<WrappedComponent data={data} />, data.routerContext);

    expect(await screen.findByTestId('performance-table')).toBeInTheDocument();

    await waitFor(() => expect(eventStatsMock).toHaveBeenCalledTimes(1)); // Only one request is made since the query batcher is working.

    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          interval: '1h',
          partial: '1',
          project: [],
          query: 'event.type:transaction',
          referrer: 'api.performance.generic-widget-chart.user-misery-area',
          statsPeriod: '14d',
          yAxis: ['user_misery()', 'tpm()', 'failure_rate()'],
        }),
      })
    );

    expect(eventsMock).toHaveBeenCalledTimes(3);

    const titles = await screen.findAllByTestId('performance-widget-title');
    expect(titles).toHaveLength(5);

    expect(titles.at(0)).toHaveTextContent('Most Regressed');
    expect(titles.at(1)).toHaveTextContent('Most Related Issues');
    expect(titles.at(2)).toHaveTextContent('User Misery');
    expect(titles.at(3)).toHaveTextContent('Transactions Per Minute');
    expect(titles.at(4)).toHaveTextContent('Failure Rate');
  });

  it('Can switch between landing displays', function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.FRONTEND_PAGELOAD, abc: '123'},
    });

    wrapper = render(<WrappedComponent data={data} />, data.routerContext);
    expect(screen.getByTestId('frontend-pageload-view')).toBeInTheDocument();
    userEvent.click(screen.getByRole('tab', {name: 'All Transactions'}));

    expect(browserHistory.push).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pathname: data.location.pathname,
        query: {query: '', abc: '123'},
      })
    );
  });

  it('Updating projects switches performance view', function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.FRONTEND_PAGELOAD},
    });

    wrapper = render(<WrappedComponent data={data} />, data.routerContext);

    expect(screen.getByTestId('frontend-pageload-view')).toBeInTheDocument();

    const updatedData = initializeData({
      projects: [TestStubs.Project({id: 123, platform: 'unknown'})],
      selectedProject: 123,
    });

    wrapper.rerender(<WrappedComponent data={updatedData} />, data.routerContext);

    expect(screen.getByTestId('all-transactions-view')).toBeInTheDocument();
  });

  it('View correctly defaults based on project without url param', function () {
    const data = initializeData({
      projects: [TestStubs.Project({id: 99, platform: 'javascript-react'})],
      selectedProject: 99,
    });

    wrapper = render(<WrappedComponent data={data} />, data.routerContext);
    expect(screen.getByTestId('frontend-pageload-view')).toBeInTheDocument();
  });

  describe('With transaction search feature', function () {
    it('does not search for empty string transaction', async function () {
      const data = initializeData();

      render(<WrappedComponent data={data} withStaticFilters />, data.routerContext);

      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));
      userEvent.type(screen.getByPlaceholderText('Search Transactions'), '{enter}');
      expect(searchHandlerMock).toHaveBeenCalledWith('', 'transactionsOnly');
    });

    it('renders the search bar', async function () {
      addMetricsDataMock();

      const data = initializeData({
        query: {
          field: 'test',
        },
      });

      wrapper = render(
        <WrappedComponent data={data} withStaticFilters />,
        data.routerContext
      );

      expect(await screen.findByTestId('transaction-search-bar')).toBeInTheDocument();
    });

    it('extracts free text from the query', async function () {
      const data = initializeData();

      wrapper = render(<WrappedComponent data={data} />, data.routerContext);

      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

      expect(await screen.findByPlaceholderText('Search Transactions')).toHaveValue('');
    });
  });

  describe('With span operations widget feature flag', function () {
    it('Displays the span operations widget', async function () {
      addMetricsDataMock();

      const data = initializeData({
        features: [
          'performance-transaction-name-only-search',
          'performance-new-widget-designs',
        ],
      });

      wrapper = render(<WrappedComponent data={data} />, data.routerContext);
      const titles = await screen.findAllByTestId('performance-widget-title');
      expect(titles.at(0)).toHaveTextContent('Span Operations');
    });
  });
});
