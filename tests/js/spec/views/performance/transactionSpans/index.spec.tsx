import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, mountWithTheme, screen, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'app/stores/projectsStore';
import {getShortEventId} from 'app/utils/events';
import {
  ExampleSpan,
  ExampleTransaction,
  SuspectSpan,
} from 'app/utils/performance/suspectSpans/types';
import TransactionSpans from 'app/views/performance/transactionSummary/transactionSpans';
import {
  SpanSortOthers,
  SpanSortPercentiles,
} from 'app/views/performance/transactionSummary/transactionSpans/types';

function initializeData({query} = {query: {}}) {
  const features = ['performance-view', 'performance-suspect-spans-view'];
  // @ts-expect-error
  const organization = TestStubs.Organization({
    features,
    // @ts-expect-error
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

type SpanOpt = {
  id: string;
};

type ExampleOpt = {
  id: string;
  description: string;
  spans: SpanOpt[];
};

type SuspectOpt = {
  op: string;
  group: string;
  examples: ExampleOpt[];
};

function makeSpan(opt: SpanOpt): ExampleSpan {
  const {id} = opt;
  return {
    id,
    startTimestamp: 10100,
    finishTimestamp: 10200,
    exclusiveTime: 100,
  };
}

function makeExample(opt: ExampleOpt): ExampleTransaction {
  const {id, description, spans} = opt;
  return {
    id,
    description,
    startTimestamp: 10000,
    finishTimestamp: 12000,
    nonOverlappingExclusiveTime: 2000,
    spans: spans.map(makeSpan),
  };
}

export function makeSuspectSpan(opt: SuspectOpt): SuspectSpan {
  const {op, group, examples} = opt;
  return {
    projectId: 1,
    project: 'bar',
    transaction: 'transaction-1',
    op,
    group,
    frequency: 1,
    count: 1,
    sumExclusiveTime: 1,
    p50ExclusiveTime: 1,
    p75ExclusiveTime: 1,
    p95ExclusiveTime: 1,
    p99ExclusiveTime: 1,
    examples: examples.map(makeExample),
  };
}

const spans = [
  {
    op: 'op1',
    group: 'aaaaaaaaaaaaaaaa',
    examples: [
      {
        id: 'abababababababab',
        description: 'span-1',
        spans: [{id: 'ababab11'}, {id: 'ababab22'}],
      },
      {
        id: 'acacacacacacacac',
        description: 'span-2',
        spans: [{id: 'acacac11'}, {id: 'acacac22'}],
      },
    ],
  },
  {
    op: 'op2',
    group: 'bbbbbbbbbbbbbbbb',
    examples: [
      {
        id: 'bcbcbcbcbcbcbcbc',
        description: 'span-3',
        spans: [{id: 'bcbcbc11'}, {id: 'bcbcbc11'}],
      },
      {
        id: 'bdbdbdbdbdbdbdbd',
        description: 'span-4',
        spans: [{id: 'bdbdbd11'}, {id: 'bdbdbd22'}],
      },
    ],
  },
];

describe('Performance > Transaction Spans', function () {
  let eventsMetaMock;
  let eventsSpanOpsMock;
  let eventsSpansPerformanceMock;
  beforeEach(function () {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
    // @ts-expect-error
    eventsMetaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: 100,
    });
    // @ts-expect-error
    eventsSpanOpsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-span-ops/',
      body: [],
    });
    // @ts-expect-error
    eventsSpansPerformanceMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-spans-performance/',
      body: spans.map(makeSuspectSpan),
    });
  });

  afterEach(function () {
    // @ts-expect-error
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
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

      // these headers should be present by default
      expect(await within(card).findByText('Span Operation')).toBeInTheDocument();
      expect(await within(card).findByText('p75 Duration')).toBeInTheDocument();
      expect(await within(card).findByText('Frequency')).toBeInTheDocument();
      expect(
        await within(card).findByText('Total Cumulative Duration')
      ).toBeInTheDocument();

      for (const example of spans[i].examples) {
        expect(
          await within(card).findByText(getShortEventId(example.id))
        ).toBeInTheDocument();
      }
    }

    expect(eventsMetaMock).toHaveBeenCalledTimes(1);
    expect(eventsSpanOpsMock).toHaveBeenCalledTimes(1);
    expect(eventsSpansPerformanceMock).toHaveBeenCalledTimes(1);
  });

  [
    {sort: SpanSortPercentiles.P50_EXCLUSIVE_TIME, label: 'p50 Duration'},
    {sort: SpanSortPercentiles.P75_EXCLUSIVE_TIME, label: 'p75 Duration'},
    {sort: SpanSortPercentiles.P95_EXCLUSIVE_TIME, label: 'p95 Duration'},
    {sort: SpanSortPercentiles.P99_EXCLUSIVE_TIME, label: 'p99 Duration'},
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

        // these headers should be present by default
        expect(await within(card).findByText('Span Operation')).toBeInTheDocument();
        expect(await within(card).findByText(label)).toBeInTheDocument();
        expect(await within(card).findByText('Frequency')).toBeInTheDocument();
        expect(
          await within(card).findByText('Total Cumulative Duration')
        ).toBeInTheDocument();

        const arrow = await within(card).findByTestId('span-sort-arrow');
        expect(arrow).toBeInTheDocument();
        expect(await within(arrow.closest('div')!).findByText(label)).toBeInTheDocument();
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

      // these headers should be present by default
      expect(await within(card).findByText('Span Operation')).toBeInTheDocument();
      expect(await within(card).findByText('p75 Duration')).toBeInTheDocument();
      expect(await within(card).findByText('Occurrences')).toBeInTheDocument();
      expect(
        await within(card).findByText('Total Cumulative Duration')
      ).toBeInTheDocument();

      const arrow = await within(card).findByTestId('span-sort-arrow');
      expect(arrow).toBeInTheDocument();
      expect(
        await within(arrow.closest('div')!).findByText('Occurrences')
      ).toBeInTheDocument();
    }
  });
});
