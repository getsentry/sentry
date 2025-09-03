import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {generateSuspectSpansResponse} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TransactionSpans from 'sentry/views/performance/transactionSummary/transactionSpans';
import {
  SpanSortOthers,
  SpanSortPercentiles,
} from 'sentry/views/performance/transactionSummary/transactionSpans/types';

function initializeData(options: {additionalFeatures?: string[]}) {
  const {additionalFeatures} = options;

  const defaultFeatures = ['performance-view'];

  const organization = OrganizationFixture({
    features: [...defaultFeatures, ...(additionalFeatures ? additionalFeatures : [])],
  });
  const initialData = initializeOrg({organization});
  act(() => ProjectsStore.loadInitialData(initialData.projects));
  return initialData;
}

const getRouterConfig = (query: Record<string, unknown>) => {
  return {
    location: {
      pathname: '/organizations/org-slug/insights/summary/',
      query: {
        transaction: 'Test Transaction',
        project: '1',
        ...query,
      },
    },
    route: '/organizations/:orgId/insights/summary/',
  };
};

describe('Performance > Transaction Spans', () => {
  let eventsMock: jest.Mock;
  let eventsSpanOpsMock: jest.Mock;
  let eventsSpansPerformanceMock: jest.Mock;
  beforeEach(() => {
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

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  describe('Without Span Data', () => {
    beforeEach(() => {
      eventsSpansPerformanceMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-performance/',
        body: [],
      });
    });

    it('renders empty state', async () => {
      const initialData = initializeData({});
      render(<TransactionSpans />, {
        organization: initialData.organization,
        initialRouterConfig: getRouterConfig({sort: SpanSortOthers.SUM_EXCLUSIVE_TIME}),
      });

      expect(
        await screen.findByText('No results found for your query')
      ).toBeInTheDocument();
    });
  });

  describe('With Span Data', () => {
    beforeEach(() => {
      eventsSpansPerformanceMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-performance/',
        body: generateSuspectSpansResponse({examples: 0}),
      });
    });

    it('renders basic UI elements', async () => {
      const initialData = initializeData({});
      render(<TransactionSpans />, {
        organization: initialData.organization,
        initialRouterConfig: getRouterConfig({sort: SpanSortOthers.SUM_EXCLUSIVE_TIME}),
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
      it('renders the right percentile header', async () => {
        const initialData = initializeData({});
        render(<TransactionSpans />, {
          organization: initialData.organization,
          initialRouterConfig: getRouterConfig({sort}),
        });

        const grid = await screen.findByTestId('grid-editable');
        expect(await within(grid).findByText('Span Operation')).toBeInTheDocument();
        expect(await within(grid).findByText('Span Name')).toBeInTheDocument();
        expect(await within(grid).findByText('Frequency')).toBeInTheDocument();
        expect(await within(grid).findByText(label)).toBeInTheDocument();
        expect(await within(grid).findByText('Total Self Time')).toBeInTheDocument();
      });
    });

    it('renders the right avg occurrence header', async () => {
      const initialData = initializeData({});
      render(<TransactionSpans />, {
        organization: initialData.organization,
        initialRouterConfig: getRouterConfig({sort: SpanSortOthers.AVG_OCCURRENCE}),
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

  describe('Spans Tab V2', () => {
    it('does not propagate transaction search query and properly tokenizes span query', async () => {
      const initialData = initializeData({
        additionalFeatures: [
          'performance-view',
          'performance-spans-new-ui',
          'insight-modules',
        ],
      });

      render(<TransactionSpans />, {
        organization: initialData.organization,
        initialRouterConfig: getRouterConfig({
          query: 'http.method:POST',
          spansQuery: 'span.op:db span.action:SELECT',
        }),
      });

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
