import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  generateSuspectSpansResponse,
  SAMPLE_SPANS,
} from 'sentry-test/performance/initializePerformanceData';
import {
  act,
  fireEvent,
  mountWithTheme,
  screen,
  within,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {getShortEventId} from 'sentry/utils/events';
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
      body: 100,
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
      mountWithTheme(
        <TransactionSpans
          organization={initialData.organization}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext}
      );

      expect(await screen.findByText('No span data found')).toBeInTheDocument();
    });
  });

  describe('With Span Data', function () {
    beforeEach(function () {
      eventsSpansPerformanceMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-performance/',
        body: generateSuspectSpansResponse(),
      });
    });

    it('renders basic UI elements', async function () {
      const initialData = initializeData({
        query: {sort: SpanSortOthers.SUM_EXCLUSIVE_TIME},
      });
      mountWithTheme(
        <TransactionSpans
          organization={initialData.organization}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext}
      );

      const cards = await screen.findAllByTestId('suspect-card');
      expect(cards).toHaveLength(2);
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        // need to narrow the search to the upper half of the card
        const upper = await within(card).findByTestId('suspect-card-upper');

        // these headers should be present by default
        expect(await within(upper).findByText('Span Operation')).toBeInTheDocument();
        expect(await within(upper).findByText('p75 Exclusive Time')).toBeInTheDocument();
        expect(await within(upper).findByText('Frequency')).toBeInTheDocument();
        expect(
          await within(upper).findByText('Total Exclusive Time')
        ).toBeInTheDocument();

        // only 2 examples show by default
        for (const example of SAMPLE_SPANS[i].examples.slice(0, 2)) {
          expect(
            await within(card).findByText(getShortEventId(example.id))
          ).toBeInTheDocument();
        }
      }

      expect(eventsV2Mock).toHaveBeenCalledTimes(1);
      expect(eventsSpanOpsMock).toHaveBeenCalledTimes(1);
      expect(eventsSpansPerformanceMock).toHaveBeenCalledTimes(1);
    });

    [
      {sort: SpanSortPercentiles.P50_EXCLUSIVE_TIME, label: 'p50 Exclusive Time'},
      {sort: SpanSortPercentiles.P75_EXCLUSIVE_TIME, label: 'p75 Exclusive Time'},
      {sort: SpanSortPercentiles.P95_EXCLUSIVE_TIME, label: 'p95 Exclusive Time'},
      {sort: SpanSortPercentiles.P99_EXCLUSIVE_TIME, label: 'p99 Exclusive Time'},
    ].forEach(({sort, label}) => {
      it('renders the right percentile header', async function () {
        const initialData = initializeData({query: {sort}});
        mountWithTheme(
          <TransactionSpans
            organization={initialData.organization}
            location={initialData.router.location}
          />,
          {context: initialData.routerContext}
        );

        const cards = await screen.findAllByTestId('suspect-card');
        expect(cards).toHaveLength(2);
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          // need to narrow the search to the upper half of the card
          const upper = await within(card).findByTestId('suspect-card-upper');

          // these headers should be present by default
          expect(await within(upper).findByText('Span Operation')).toBeInTheDocument();
          expect(await within(upper).findByText(label)).toBeInTheDocument();
          expect(await within(upper).findByText('Frequency')).toBeInTheDocument();
          expect(
            await within(upper).findByText('Total Exclusive Time')
          ).toBeInTheDocument();

          const arrow = await within(upper).findByTestId('span-sort-arrow');
          expect(arrow).toBeInTheDocument();
          expect(
            await within(arrow.closest('div')!).findByText(label)
          ).toBeInTheDocument();
        }
      });
    });

    it('renders the right count header', async function () {
      const initialData = initializeData({query: {sort: SpanSortOthers.COUNT}});
      mountWithTheme(
        <TransactionSpans
          organization={initialData.organization}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext}
      );

      const cards = await screen.findAllByTestId('suspect-card');
      expect(cards).toHaveLength(2);
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        // need to narrow the search to the upper half of the card
        const upper = await within(card).findByTestId('suspect-card-upper');

        // these headers should be present by default
        expect(await within(upper).findByText('Span Operation')).toBeInTheDocument();
        expect(await within(upper).findByText('p75 Exclusive Time')).toBeInTheDocument();
        expect(await within(upper).findByText('Total Count')).toBeInTheDocument();
        expect(
          await within(upper).findByText('Total Exclusive Time')
        ).toBeInTheDocument();

        const arrow = await within(upper).findByTestId('span-sort-arrow');
        expect(arrow).toBeInTheDocument();
        expect(
          await within(arrow.closest('div')!).findByText('Total Count')
        ).toBeInTheDocument();
      }
    });

    it('renders the right avg occurrence header', async function () {
      const initialData = initializeData({query: {sort: SpanSortOthers.AVG_OCCURRENCE}});
      mountWithTheme(
        <TransactionSpans
          organization={initialData.organization}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext}
      );

      const cards = await screen.findAllByTestId('suspect-card');
      expect(cards).toHaveLength(2);
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        // need to narrow the search to the upper half of the card
        const upper = await within(card).findByTestId('suspect-card-upper');

        // these headers should be present by default
        expect(await within(upper).findByText('Span Operation')).toBeInTheDocument();
        expect(await within(upper).findByText('p75 Exclusive Time')).toBeInTheDocument();
        expect(await within(upper).findByText('Average Count')).toBeInTheDocument();
        expect(
          await within(upper).findByText('Total Exclusive Time')
        ).toBeInTheDocument();

        const arrow = await within(upper).findByTestId('span-sort-arrow');
        expect(arrow).toBeInTheDocument();
        expect(
          await within(arrow.closest('div')!).findByText('Average Count')
        ).toBeInTheDocument();
      }
    });

    it('renders the right table headers', async function () {
      const initialData = initializeData();
      mountWithTheme(
        <TransactionSpans
          organization={initialData.organization}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext}
      );

      const cards = await screen.findAllByTestId('suspect-card');
      expect(cards).toHaveLength(2);
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const lower = await within(card).findByTestId('suspect-card-lower');

        expect(await within(lower).findByText('Example Transaction')).toBeInTheDocument();
        expect(await within(lower).findByText('Timestamp')).toBeInTheDocument();
        expect(await within(lower).findByText('Span Duration')).toBeInTheDocument();
        expect(await within(lower).findByText('Count')).toBeInTheDocument();
        expect(await within(lower).findByText('Cumulative Duration')).toBeInTheDocument();
      }
    });

    it('allows toggling of more examples', async function () {
      const initialData = initializeData();
      mountWithTheme(
        <TransactionSpans
          organization={initialData.organization}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext}
      );

      const cards = await screen.findAllByTestId('suspect-card');
      expect(cards).toHaveLength(2);
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];

        expect(
          within(card).queryByText('Show More Transaction Examples')
        ).toBeInTheDocument();
        expect(
          within(card).queryByText('Hide Transaction Examples')
        ).not.toBeInTheDocument();

        // only 2 examples show by default
        for (const example of SAMPLE_SPANS[i].examples.slice(0, 2)) {
          expect(
            await within(card).findByText(getShortEventId(example.id))
          ).toBeInTheDocument();
        }

        fireEvent.click(await within(card).findByText('Show More Transaction Examples'));

        expect(within(card).queryByText('Hide Transaction Examples')).toBeInTheDocument();
        expect(
          within(card).queryByText('Show More Transaction Examples')
        ).not.toBeInTheDocument();

        // each span has 3 examples
        expect(SAMPLE_SPANS[i].examples).toHaveLength(3);

        // all the examples should be shown now
        for (const example of SAMPLE_SPANS[i].examples) {
          expect(
            await within(card).findByText(getShortEventId(example.id))
          ).toBeInTheDocument();
        }
      }
    });
  });
});
