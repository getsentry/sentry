import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {generateSuspectSpansResponse} from 'sentry-test/performance/initializePerformanceData';
import {
  act,
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import TransactionSpans from 'sentry/views/performance/transactionSummary/transactionSpans';
import {
  SpanSortOthers,
  SpanSortPercentiles,
} from 'sentry/views/performance/transactionSummary/transactionSpans/types';

jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

function initializeData(options: {query: {}; additionalFeatures?: string[]}) {
  const {query, additionalFeatures} = options;

  const defaultFeatures = ['performance-view'];

  const organization = OrganizationFixture({
    features: [...defaultFeatures, ...(additionalFeatures ? additionalFeatures : [])],
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: 'Test Transaction',
          project: '1',
          ...query,
        },
      },
    },
  });
  act(() => void ProjectsStore.loadInitialData(initialData.projects));
  return initialData;
}

describe('Performance > Transaction Spans', function () {
  let eventsMock: jest.Mock;
  let eventsSpanOpsMock: jest.Mock;
  let eventsSpansPerformanceMock: jest.Mock;
  beforeEach(function () {
    mockUseLocation.mockReturnValue(
      LocationFixture({pathname: '/organizations/org-slug/performance/summary'})
    );
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [{'count()': 100}],
    });
    eventsSpanOpsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-span-ops/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/spans/fields/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  describe('Without Span Data', function () {
    beforeEach(function () {
      eventsSpansPerformanceMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-performance/',
        body: [],
      });
    });

    it('renders empty state', async function () {
      const initialData = initializeData({
        query: {sort: SpanSortOthers.SUM_EXCLUSIVE_TIME},
      });
      render(<TransactionSpans location={initialData.router.location} />, {
        router: initialData.router,
        organization: initialData.organization,
      });

      expect(
        await screen.findByText('No results found for your query')
      ).toBeInTheDocument();
    });
  });

  describe('With Span Data', function () {
    beforeEach(function () {
      eventsSpansPerformanceMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-performance/',
        body: generateSuspectSpansResponse({examples: 0}),
      });
    });

    it('renders basic UI elements', async function () {
      const initialData = initializeData({
        query: {sort: SpanSortOthers.SUM_EXCLUSIVE_TIME},
      });
      render(<TransactionSpans location={initialData.router.location} />, {
        router: initialData.router,
        organization: initialData.organization,
      });

      // default visible columns
      const grid = await screen.findByTestId('grid-editable');
      expect(await within(grid).findByText('Span Operation')).toBeInTheDocument();
      expect(await within(grid).findByText('Span Name')).toBeInTheDocument();
      expect(await within(grid).findByText('Frequency')).toBeInTheDocument();
      expect(await within(grid).findByText('P75 Self Time')).toBeInTheDocument();
      expect(await within(grid).findByText('Total Self Time')).toBeInTheDocument();

      // there should be a row for each of the spans
      expect(await within(grid).findByText('op1')).toBeInTheDocument();
      expect(await within(grid).findByText('op2')).toBeInTheDocument();

      expect(eventsMock).toHaveBeenCalledTimes(1);
      expect(eventsSpanOpsMock).toHaveBeenCalledTimes(1);
      expect(eventsSpansPerformanceMock).toHaveBeenCalledTimes(1);
    });

    [
      {sort: SpanSortPercentiles.P50_EXCLUSIVE_TIME, label: 'P50 Self Time'},
      {sort: SpanSortPercentiles.P75_EXCLUSIVE_TIME, label: 'P75 Self Time'},
      {sort: SpanSortPercentiles.P95_EXCLUSIVE_TIME, label: 'P95 Self Time'},
      {sort: SpanSortPercentiles.P99_EXCLUSIVE_TIME, label: 'P99 Self Time'},
    ].forEach(({sort, label}) => {
      it('renders the right percentile header', async function () {
        const initialData = initializeData({query: {sort}});
        render(<TransactionSpans location={initialData.router.location} />, {
          router: initialData.router,
          organization: initialData.organization,
        });

        const grid = await screen.findByTestId('grid-editable');
        expect(await within(grid).findByText('Span Operation')).toBeInTheDocument();
        expect(await within(grid).findByText('Span Name')).toBeInTheDocument();
        expect(await within(grid).findByText('Frequency')).toBeInTheDocument();
        expect(await within(grid).findByText(label)).toBeInTheDocument();
        expect(await within(grid).findByText('Total Self Time')).toBeInTheDocument();
      });
    });

    it('renders the right avg occurrence header', async function () {
      const initialData = initializeData({query: {sort: SpanSortOthers.AVG_OCCURRENCE}});
      render(<TransactionSpans location={initialData.router.location} />, {
        router: initialData.router,
        organization: initialData.organization,
      });

      const grid = await screen.findByTestId('grid-editable');
      expect(await within(grid).findByText('Span Operation')).toBeInTheDocument();
      expect(await within(grid).findByText('Span Name')).toBeInTheDocument();
      expect(await within(grid).findByText('Average Occurrences')).toBeInTheDocument();
      expect(await within(grid).findByText('Frequency')).toBeInTheDocument();
      expect(await within(grid).findByText('P75 Self Time')).toBeInTheDocument();
      expect(await within(grid).findByText('Total Self Time')).toBeInTheDocument();
    });
  });

  describe('Spans Tab V2', function () {
    it('does not propagate transaction search query and properly tokenizes span query', async function () {
      const initialData = initializeData({
        query: {query: 'http.method:POST', spansQuery: 'span.op:db span.action:SELECT'},
        additionalFeatures: [
          'performance-view',
          'performance-spans-new-ui',
          'insights-initial-modules',
        ],
      });

      render(<TransactionSpans location={initialData.router.location} />, {
        router: initialData.router,
        organization: initialData.organization,
      });

      await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

      const searchBar = await screen.findByTestId('search-query-builder');

      expect(
        within(searchBar).getByRole('row', {name: 'span.op:db'})
      ).toBeInTheDocument();
      expect(
        within(searchBar).getByRole('row', {name: 'span.action:SELECT'})
      ).toBeInTheDocument();

      expect(
        within(searchBar).queryByRole('row', {name: 'http.method:POST'})
      ).not.toBeInTheDocument();
    });
  });
});
