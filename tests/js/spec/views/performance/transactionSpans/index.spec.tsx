import {initializeOrg} from 'sentry-test/initializeOrg';
import {generateSuspectSpansResponse} from 'sentry-test/performance/initializePerformanceData';
import {act, mountWithTheme, screen, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TransactionSpans from 'sentry/views/performance/transactionSummary/transactionSpans';
import {
  SpanSortOthers,
  SpanSortPercentiles,
} from 'sentry/views/performance/transactionSummary/transactionSpans/types';

function initializeData({query} = {query: {}}) {
  const features = ['performance-view', 'performance-suspect-spans-view'];
  const organization = TestStubs.Organization({
    features,
    projects: [TestStubs.Project()],
  });
  const initialData = initializeOrg({
    ...initializeOrg(),
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
  act(() => void ProjectsStore.loadInitialData(initialData.organization.projects));
  return initialData;
}

describe('Performance > Transaction Spans', function () {
  let eventsV2Mock;
  let eventsSpanOpsMock;
  let eventsSpansPerformanceMock;
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
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
    eventsV2Mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: [{count: 100}],
    });
    eventsSpanOpsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-span-ops/',
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
      mountWithTheme(<TransactionSpans location={initialData.router.location} />, {
        context: initialData.routerContext,
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
      mountWithTheme(<TransactionSpans location={initialData.router.location} />, {
        context: initialData.routerContext,
        organization: initialData.organization,
      });

      // default visible columns
      const grid = await screen.findByTestId('grid-editable');
      expect(await within(grid).findByText('Span Operation')).toBeInTheDocument();
      expect(await within(grid).findByText('Span Name')).toBeInTheDocument();
      expect(await within(grid).findByText('Total Count')).toBeInTheDocument();
      expect(await within(grid).findByText('Frequency')).toBeInTheDocument();
      expect(await within(grid).findByText('P75 Exclusive Time')).toBeInTheDocument();
      expect(await within(grid).findByText('Total Exclusive Time')).toBeInTheDocument();

      // there should be a row for each of the spans
      expect(await within(grid).findByText('op1')).toBeInTheDocument();
      expect(await within(grid).findByText('op2')).toBeInTheDocument();

      expect(eventsV2Mock).toHaveBeenCalledTimes(1);
      expect(eventsSpanOpsMock).toHaveBeenCalledTimes(1);
      expect(eventsSpansPerformanceMock).toHaveBeenCalledTimes(1);
    });

    [
      {sort: SpanSortPercentiles.P50_EXCLUSIVE_TIME, label: 'P50 Exclusive Time'},
      {sort: SpanSortPercentiles.P75_EXCLUSIVE_TIME, label: 'P75 Exclusive Time'},
      {sort: SpanSortPercentiles.P95_EXCLUSIVE_TIME, label: 'P95 Exclusive Time'},
      {sort: SpanSortPercentiles.P99_EXCLUSIVE_TIME, label: 'P99 Exclusive Time'},
    ].forEach(({sort, label}) => {
      it('renders the right percentile header', async function () {
        const initialData = initializeData({query: {sort}});
        mountWithTheme(<TransactionSpans location={initialData.router.location} />, {
          context: initialData.routerContext,
          organization: initialData.organization,
        });

        const grid = await screen.findByTestId('grid-editable');
        expect(await within(grid).findByText('Span Operation')).toBeInTheDocument();
        expect(await within(grid).findByText('Span Name')).toBeInTheDocument();
        expect(await within(grid).findByText('Total Count')).toBeInTheDocument();
        expect(await within(grid).findByText('Frequency')).toBeInTheDocument();
        expect(await within(grid).findByText(label)).toBeInTheDocument();
        expect(await within(grid).findByText('Total Exclusive Time')).toBeInTheDocument();
      });
    });

    it('renders the right count header', async function () {
      const initialData = initializeData({query: {sort: SpanSortOthers.COUNT}});
      mountWithTheme(<TransactionSpans location={initialData.router.location} />, {
        context: initialData.routerContext,
        organization: initialData.organization,
      });

      const grid = await screen.findByTestId('grid-editable');
      expect(await within(grid).findByText('Span Operation')).toBeInTheDocument();
      expect(await within(grid).findByText('Span Name')).toBeInTheDocument();
      expect(await within(grid).findByText('Total Count')).toBeInTheDocument();
      expect(await within(grid).findByText('Frequency')).toBeInTheDocument();
      expect(await within(grid).findByText('P75 Exclusive Time')).toBeInTheDocument();
      expect(await within(grid).findByText('Total Exclusive Time')).toBeInTheDocument();
    });

    it('renders the right avg occurrence header', async function () {
      const initialData = initializeData({query: {sort: SpanSortOthers.AVG_OCCURRENCE}});
      mountWithTheme(<TransactionSpans location={initialData.router.location} />, {
        context: initialData.routerContext,
        organization: initialData.organization,
      });

      const grid = await screen.findByTestId('grid-editable');
      expect(await within(grid).findByText('Span Operation')).toBeInTheDocument();
      expect(await within(grid).findByText('Span Name')).toBeInTheDocument();
      expect(await within(grid).findByText('Average Occurrences')).toBeInTheDocument();
      expect(await within(grid).findByText('Frequency')).toBeInTheDocument();
      expect(await within(grid).findByText('P75 Exclusive Time')).toBeInTheDocument();
      expect(await within(grid).findByText('Total Exclusive Time')).toBeInTheDocument();
    });
  });
});
