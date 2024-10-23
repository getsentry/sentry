import * as Sentry from '@sentry/react';
import MockDate from 'mockdate';
import {TransactionEventFixture} from 'sentry-fixture/event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  findAllByText,
  findByText,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {EntryType, type EventTransaction} from 'sentry/types/event';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {TraceView} from 'sentry/views/performance/newTraceDetails/index';
import {
  makeEventTransaction,
  makeSpan,
  makeTraceError,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

jest.mock('screenfull', () => ({
  enabled: true,
  get isFullscreen() {
    return false;
  },
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  unobserve(_element: HTMLElement) {
    return;
  }

  observe(element: HTMLElement) {
    // Executes in sync so we dont have to
    this.callback(
      [
        {
          target: element,
          // @ts-expect-error partial mock
          contentRect: {width: 1000, height: 24 * 20 - 1},
        },
      ],
      this
    );
  }
  disconnect() {}
}

type Arguments<F extends Function> = F extends (...args: infer A) => any ? A : never;
type ResponseType = Arguments<typeof MockApiClient.addMockResponse>[0];

function mockQueryString(query: string) {
  Object.defineProperty(window, 'location', {
    value: {
      search: query,
    },
  });
}

function mockTraceResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-trace/trace-id/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {body: {}}),
  });
}

function mockTraceMetaResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-trace-meta/trace-id/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {
      body: {
        errors: 0,
        performance_issues: 0,
        projects: 0,
        transactions: 0,
        transaction_child_count_map: [],
      },
    }),
  });
}

function mockTraceTagsResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-facets/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {body: []}),
  });
}

// function _mockTraceDetailsResponse(id: string, resp?: Partial<ResponseType>) {
//   MockApiClient.addMockResponse({
//     url: `/organizations/org-slug/events/project_slug:transaction-${id}`,
//     method: 'GET',
//     asyncDelay: 1,
//     ...(resp ?? {}),
//   });
// }

function mockTransactionDetailsResponse(id: string, resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/project_slug:${id}/`,
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {body: TransactionEventFixture()}),
  });
}

function mockTraceRootEvent(id: string, resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/project_slug:${id}/`,
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {body: TransactionEventFixture()}),
  });
}

function mockTraceRootFacets(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events-facets/`,
    method: 'GET',
    asyncDelay: 1,
    body: {},
    ...(resp ?? {}),
  });
}

function mockTraceEventDetails(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/`,
    method: 'GET',
    asyncDelay: 1,
    body: {},
    ...(resp ?? {body: TransactionEventFixture()}),
  });
}

function mockSpansResponse(
  id: string,
  resp?: Partial<ResponseType>,
  body: Partial<EventTransaction> = {}
) {
  return MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/project_slug:${id}/?averageColumn=span.self_time&averageColumn=span.duration`,
    method: 'GET',
    asyncDelay: 1,
    body,
    ...(resp ?? {}),
  });
}

function mockTransactionSpansResponse(
  id: string,
  resp?: Partial<ResponseType>,
  body: Partial<EventTransaction> = {}
) {
  return MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/project_slug:${id}/`,
    method: 'GET',
    asyncDelay: 1,
    body,
    ...(resp ?? {}),
  });
}

const {router} = initializeOrg({
  router: {
    params: {orgId: 'org-slug', traceSlug: 'trace-id'},
  },
});

function mockMetricsResponse() {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/metrics/query/',
    method: 'POST',
    body: {
      data: [],
      queries: [],
    },
  });
}

function getVirtualizedContainer(): HTMLElement {
  const virtualizedContainer = screen.queryByTestId('trace-virtualized-list');
  if (!virtualizedContainer) {
    throw new Error('Virtualized container not found');
  }
  return virtualizedContainer;
}

function getVirtualizedScrollContainer(): HTMLElement {
  const virtualizedScrollContainer = screen.queryByTestId(
    'trace-virtualized-list-scroll-container'
  );

  if (!virtualizedScrollContainer) {
    throw new Error('Virtualized scroll container not found');
  }
  return virtualizedScrollContainer;
}

async function keyboardNavigationTestSetup() {
  const keyboard_navigation_transactions: TraceFullDetailed[] = [];
  for (let i = 0; i < 1e4; i++) {
    keyboard_navigation_transactions.push(
      makeTransaction({
        span_id: i + '',
        event_id: i + '',
        transaction: 'transaction-name-' + i,
        'transaction.op': 'transaction-op-' + i,
        project_slug: 'project_slug',
      })
    );
    mockTransactionDetailsResponse(i.toString());
  }
  mockTraceResponse({
    body: {
      transactions: keyboard_navigation_transactions,
      orphan_errors: [],
    },
  });
  mockTraceMetaResponse({
    body: {
      errors: 0,
      performance_issues: 0,
      projects: 0,
      transactions: 0,
      transaction_child_count_map: keyboard_navigation_transactions.map(t => ({
        'transaction.id': t.event_id,
        count: 5,
      })),
    },
  });
  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockMetricsResponse();

  const value = render(<TraceView />, {router});
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  expect(await findByText(value.container, /transaction-op-0/i)).toBeInTheDocument();
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

async function pageloadTestSetup() {
  const pageloadTransactions: TraceFullDetailed[] = [];
  for (let i = 0; i < 1e3; i++) {
    pageloadTransactions.push(
      makeTransaction({
        span_id: i + '',
        event_id: i + '',
        transaction: 'transaction-name-' + i,
        'transaction.op': 'transaction-op-' + i,
        project_slug: 'project_slug',
      })
    );
    mockTransactionDetailsResponse(i.toString());
  }
  mockTraceResponse({
    body: {
      transactions: pageloadTransactions,
      orphan_errors: [],
    },
  });
  mockTraceMetaResponse({
    body: {
      errors: 0,
      performance_issues: 0,
      projects: 0,
      transactions: 0,
      transaction_child_count_map: pageloadTransactions.map(t => ({
        'transaction.id': t.event_id,
        count: 5,
      })),
    },
  });
  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockMetricsResponse();

  const value = render(<TraceView />, {router});
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  expect((await screen.findAllByText(/transaction-op-/i)).length).toBeGreaterThan(0);
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

async function nestedTransactionsTestSetup() {
  const transactions: TraceFullDetailed[] = [];

  let txn = makeTransaction({
    span_id: '0',
    event_id: '0',
    transaction: 'transaction-name-0',
    'transaction.op': 'transaction-op-0',
    project_slug: 'project_slug',
  });

  transactions.push(txn);

  for (let i = 0; i < 100; i++) {
    const next = makeTransaction({
      span_id: i + '',
      event_id: i + '',
      transaction: 'transaction-name-' + i,
      'transaction.op': 'transaction-op-' + i,
      project_slug: 'project_slug',
    });

    txn.children.push(next);
    txn = next;
    transactions.push(next);

    mockTransactionDetailsResponse(i.toString());
  }

  mockTraceResponse({
    body: {
      transactions: transactions,
      orphan_errors: [],
    },
  });
  mockTraceMetaResponse();
  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockMetricsResponse();

  const value = render(<TraceView />, {router});
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  expect((await screen.findAllByText(/transaction-op-/i)).length).toBeGreaterThan(0);
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

async function searchTestSetup() {
  const transactions: TraceFullDetailed[] = [];
  for (let i = 0; i < 11; i++) {
    transactions.push(
      makeTransaction({
        span_id: i + '',
        event_id: i + '',
        transaction: 'transaction-name' + i,
        'transaction.op': 'transaction-op-' + i,
        project_slug: 'project_slug',
      })
    );
    mockTransactionDetailsResponse(i.toString());
  }
  mockTraceResponse({
    body: {
      transactions: transactions,
      orphan_errors: [],
    },
  });

  mockTraceMetaResponse({
    body: {
      errors: 0,
      performance_issues: 0,
      projects: 0,
      transactions: 0,
      transaction_child_count_map: transactions.map(t => ({
        'transaction.id': t.event_id,
        count: 5,
      })),
    },
  });

  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockMetricsResponse();

  const value = render(<TraceView />, {router});
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  expect(await findByText(value.container, /transaction-op-0/i)).toBeInTheDocument();
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

async function simpleTestSetup() {
  const transactions: TraceFullDetailed[] = [];
  let parent: any;
  for (let i = 0; i < 1e3; i++) {
    const next = makeTransaction({
      span_id: i + '',
      event_id: i + '',
      transaction: 'transaction-name' + i,
      'transaction.op': 'transaction-op-' + i,
      project_slug: 'project_slug',
    });

    if (parent) {
      parent.children.push(next);
    } else {
      transactions.push(next);
    }
    parent = next;
    mockTransactionDetailsResponse(i.toString());
  }
  mockTraceResponse({
    body: {
      transactions: transactions,
      orphan_errors: [],
    },
  });
  mockTraceMetaResponse({
    body: {
      errors: 0,
      performance_issues: 0,
      projects: 0,
      transactions: 0,
      transaction_child_count_map: transactions.map(t => ({
        'transaction.id': t.event_id,
        count: 5,
      })),
    },
  });
  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockMetricsResponse();

  const value = render(<TraceView />, {router});
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  expect(await findByText(value.container, /transaction-op-0/i)).toBeInTheDocument();
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

async function completeTestSetup() {
  const start = Date.now() / 1e3;

  mockTraceResponse({
    body: {
      transactions: [
        makeTransaction({
          event_id: '0',
          transaction: 'transaction-name-0',
          'transaction.op': 'transaction-op-0',
          project_slug: 'project_slug',
          start_timestamp: start,
          timestamp: start + 2,
          children: [
            makeTransaction({
              event_id: '1',
              transaction: 'transaction-name-1',
              'transaction.op': 'transaction-op-1',
              project_slug: 'project_slug',
              start_timestamp: start,
              timestamp: start + 2,
            }),
          ],
        }),
        makeTransaction({
          event_id: '2',
          transaction: 'transaction-name-2',
          'transaction.op': 'transaction-op-2',
          project_slug: 'project_slug',
          start_timestamp: start,
          timestamp: start + 2,
        }),
        makeTransaction({
          event_id: '3',
          transaction: 'transaction-name-3',
          'transaction.op': 'transaction-op-3',
          project_slug: 'project_slug',
          start_timestamp: start,
          timestamp: start + 2,
        }),
      ],
      orphan_errors: [
        makeTraceError({
          event_id: 'error0',
          issue: 'error-issue',
          project_id: 0,
          project_slug: 'project_slug',
          issue_id: 0,
          title: 'error-title',
          level: 'fatal',
          timestamp: start + 2,
        }),
      ],
    },
  });
  mockTraceMetaResponse({
    body: {
      errors: 0,
      performance_issues: 0,
      projects: 0,
      transactions: 0,
      transaction_child_count_map: [
        {
          'transaction.id': '0',
          count: 2,
        },
        {
          'transaction.id': '1',
          count: 2,
        },
        {
          'transaction.id': '2',
          count: 2,
        },
        {
          'transaction.id': '3',
          count: 2,
        },
      ],
    },
  });
  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockMetricsResponse();

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/project_slug:error0/',
    body: {
      tags: [],
      contexts: {},
      entries: [],
    },
  });

  const transactionWithSpans = makeEventTransaction({
    entries: [
      {
        type: EntryType.SPANS,
        data: [
          makeSpan({
            span_id: 'span0',
            op: 'http',
            description: 'request',
            start_timestamp: start,
            timestamp: start + 0.1,
          }),
          // Parent autogroup chain
          makeSpan({
            op: 'db',
            description: 'redis',
            parent_span_id: 'span0',
            span_id: 'redis0',
            start_timestamp: start + 0.1,
            timestamp: start + 0.2,
          }),
          makeSpan({
            op: 'db',
            description: 'redis',
            parent_span_id: 'redis0',
            span_id: 'redis1',
            start_timestamp: start + 0.2,
            timestamp: start + 0.3,
          }),
          // Sibling autogroup chain
          makeSpan({
            op: 'http',
            description: 'request',
            parent_span_id: 'span0',
            span_id: 'http0',
            start_timestamp: start + 0.3,
            timestamp: start + 0.4,
          }),
          makeSpan({
            op: 'http',
            description: 'request',
            parent_span_id: 'span0',
            span_id: 'http1',
            start_timestamp: start + 0.4,
            timestamp: start + 0.5,
          }),
          makeSpan({
            op: 'http',
            description: 'request',
            parent_span_id: 'span0',
            span_id: 'http2',
            start_timestamp: start + 0.5,
            timestamp: start + 0.6,
          }),
          makeSpan({
            op: 'http',
            description: 'request',
            parent_span_id: 'span0',
            span_id: 'http3',
            start_timestamp: start + 0.6,
            timestamp: start + 0.7,
          }),
          makeSpan({
            op: 'http',
            description: 'request',
            parent_span_id: 'span0',
            span_id: 'http4',
            start_timestamp: start + 0.7,
            timestamp: start + 0.8,
          }),
          // Missing instrumentation gap
          makeSpan({
            op: 'queue',
            description: 'process',
            parent_span_id: 'span0',
            span_id: 'queueprocess0',
            start_timestamp: start + 0.8,
            timestamp: start + 0.9,
          }),
          makeSpan({
            op: 'queue',
            description: 'process',
            parent_span_id: 'span0',
            span_id: 'queueprocess1',
            start_timestamp: start + 1.1,
            timestamp: start + 1.2,
          }),
        ],
      },
    ],
  });

  const transactionWithoutSpans = makeEventTransaction({});

  mockTransactionSpansResponse('1', {}, transactionWithSpans);
  mockSpansResponse('1', {}, transactionWithSpans);
  // Mock empty response for txn without spans
  mockTransactionSpansResponse('0', {}, transactionWithoutSpans);
  mockSpansResponse('0', {}, transactionWithoutSpans);

  const value = render(<TraceView />, {router});
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  expect(await findByText(value.container, /transaction-op-0/i)).toBeInTheDocument();
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

const DRAWER_TABS_TEST_ID = 'trace-drawer-tab';
const DRAWER_TABS_PIN_BUTTON_TEST_ID = 'trace-drawer-tab-pin-button';

// @ts-expect-error ignore this line
// eslint-disable-next-line
const DRAWER_TABS_CONTAINER_TEST_ID = 'trace-drawer-tabs';
const VISIBLE_TRACE_ROW_SELECTOR = '.TraceRow:not(.Hidden)';
const ACTIVE_SEARCH_HIGHLIGHT_ROW = '.TraceRow.SearchResult.Highlight:not(.Hidden)';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const searchToUpdate = async (): Promise<void> => {
  await wait(500);
};

const scrollToEnd = async (): Promise<void> => {
  await wait(1000);
};

// @ts-expect-error ignore this line
// eslint-disable-next-line
function printVirtualizedList(container: HTMLElement) {
  const stdout: string[] = [];
  const scrollContainer = screen.queryByTestId(
    'trace-virtualized-list-scroll-container'
  )!;

  const rows = Array.from(container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR));
  stdout.push(
    'top:' +
      scrollContainer.scrollTop +
      ' ' +
      'left:' +
      scrollContainer.scrollLeft +
      ' ' +
      rows.length
  );
  stdout.push('///////////////////');

  for (const r of [...rows]) {
    let t = r.textContent ?? '';

    if (r.classList.contains('SearchResult')) {
      t = 'search ' + t;
    }
    if (r.classList.contains('Highlight')) {
      t = 'highlight ' + t;
    }

    if (document.activeElement === r) {
      t = '⬅ focused ' + t;
    }

    stdout.push(t);
  }

  // This is a debug fn, we need it to log
  // eslint-disable-next-line
  console.log(stdout.join('\n'));
}

// @ts-expect-error ignore this line
// eslint-disable-next-line
function printTabs() {
  const tabs = screen.queryAllByTestId(DRAWER_TABS_TEST_ID);
  const stdout: string[] = [];

  for (const tab of tabs) {
    let text = tab.textContent ?? 'empty tab??';
    if (tab.hasAttribute('aria-selected')) {
      text = 'active' + text;
    }
    stdout.push(text);
  }

  // This is a debug fn, we need it to log
  // eslint-disable-next-line
  console.log(stdout.join(' | '));
}

function assertHighlightedRowAtIndex(virtualizedContainer: HTMLElement, index: number) {
  expect(virtualizedContainer.querySelectorAll('.TraceRow.Highlight')).toHaveLength(1);
  const highlighted_row = virtualizedContainer.querySelector(ACTIVE_SEARCH_HIGHLIGHT_ROW);
  const r = Array.from(virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR));
  expect(r.indexOf(highlighted_row!)).toBe(index);
}

describe('trace', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.ResizeObserver = MockResizeObserver as any;
    MockDate.reset();
  });
  afterEach(() => {
    mockQueryString('');
    // @ts-expect-error clear mock
    globalThis.ResizeObserver = undefined;
  });

  it('renders loading state', async () => {
    mockTraceResponse();
    mockTraceMetaResponse();
    mockTraceTagsResponse();

    render(<TraceView />, {router});
    expect(await screen.findByText(/assembling the trace/i)).toBeInTheDocument();
  });

  it('renders error state', async () => {
    mockTraceResponse({statusCode: 404});
    mockTraceMetaResponse({statusCode: 404});
    mockTraceTagsResponse({statusCode: 404});

    render(<TraceView />, {router});
    expect(await screen.findByText(/we failed to load your trace/i)).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    mockTraceResponse({
      body: {
        transactions: [],
        orphan_errors: [],
      },
    });
    mockTraceMetaResponse();
    mockTraceTagsResponse();

    render(<TraceView />, {router});
    expect(
      await screen.findByText(/trace does not contain any data/i)
    ).toBeInTheDocument();
  });

  describe('pageload', () => {
    it('scrolls to trace root', async () => {
      mockQueryString('?node=trace-root');
      const {virtualizedContainer} = await completeTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(rows[0]).toHaveFocus();
    });

    it('scrolls to transaction', async () => {
      mockQueryString('?node=txn-1');
      const {virtualizedContainer} = await completeTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(rows[2]).toHaveFocus();
    });

    it('scrolls to span that is a child of transaction', async () => {
      mockQueryString('?node=span-span0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await findAllByText(virtualizedContainer, /Autogrouped/i);

      // We need to await a tick because the row is not focused until the next tick
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await waitFor(() => {
        expect(rows[3]).toHaveFocus();
        expect(rows[3].textContent?.includes('http — request')).toBe(true);
      });
    });

    it('scrolls to parent autogroup node', async () => {
      mockQueryString('?node=ag-redis0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await findAllByText(virtualizedContainer, /Autogrouped/i);

      // We need to await a tick because the row is not focused until the next tick
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await waitFor(() => {
        expect(rows[4]).toHaveFocus();
        expect(rows[4].textContent?.includes('Autogrouped')).toBe(true);
      });
    });
    it('scrolls to child of parent autogroup node', async () => {
      mockQueryString('?node=span-redis0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await findAllByText(virtualizedContainer, /Autogrouped/i);

      // We need to await a tick because the row is not focused until the next tick
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await waitFor(() => {
        expect(rows[5]).toHaveFocus();
        expect(rows[5].textContent?.includes('db — redis')).toBe(true);
      });
    });

    it('scrolls to sibling autogroup node', async () => {
      mockQueryString('?node=ag-http0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await findAllByText(virtualizedContainer, /Autogrouped/i);

      // We need to await a tick because the row is not focused until the next tick
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await waitFor(() => {
        expect(rows[5]).toHaveFocus();
        expect(rows[5].textContent?.includes('5Autogrouped')).toBe(true);
      });
    });

    it('scrolls to child of sibling autogroup node', async () => {
      mockQueryString('?node=span-http0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await findAllByText(virtualizedContainer, /Autogrouped/i);

      // We need to await a tick because the row is not focused until the next tick
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await waitFor(() => {
        expect(rows[6]).toHaveFocus();
        expect(rows[6].textContent?.includes('http — request')).toBe(true);
      });
    });

    it('scrolls to missing instrumentation node', async () => {
      mockQueryString('?node=ms-queueprocess0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await findAllByText(virtualizedContainer, /Autogrouped/i);

      // We need to await a tick because the row is not focused until the next ticks
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await waitFor(() => {
        expect(rows[7]).toHaveFocus();
        expect(rows[7].textContent?.includes('Missing instrumentation')).toBe(true);
      });
    });

    it('scrolls to trace error node', async () => {
      mockQueryString('?node=error-error0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await findAllByText(virtualizedContainer, /Autogrouped/i);

      // We need to await a tick because the row is not focused until the next ticks
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await waitFor(() => {
        expect(rows[11]).toHaveFocus();
        expect(rows[11].textContent?.includes('error-title')).toBe(true);
      });
    });

    it('scrolls to event id query param', async () => {
      mockQueryString('?eventId=1');
      const {virtualizedContainer} = await completeTestSetup();

      await waitFor(() => {
        const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[2]).toHaveFocus();
      });
    });

    it('supports expanded node path', async () => {
      mockQueryString('?node=span-span0&node=txn-1&span-0&node=txn-0');
      const {virtualizedContainer} = await completeTestSetup();
      await findAllByText(virtualizedContainer, /Autogrouped/i);

      await waitFor(() => {
        const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[3]).toHaveFocus();
        expect(rows[3].textContent?.includes('http — request')).toBe(true);
      });
    });

    it.each([
      '?eventId=doesnotexist',
      '?node=txn-doesnotexist',
      // Invalid path
      '?node=span-does-notexist',
    ])('logs if path is not found: %s', async path => {
      mockQueryString(path);

      const sentryScopeMock = {
        setFingerprint: jest.fn(),
        captureMessage: jest.fn(),
      } as any;

      jest.spyOn(Sentry, 'withScope').mockImplementation((f: any) => f(sentryScopeMock));
      await pageloadTestSetup();

      await waitFor(() => {
        expect(sentryScopeMock.captureMessage).toHaveBeenCalledWith(
          'Failed to scroll to node in trace tree'
        );
      });
    });

    it('triggers search on load', async () => {
      mockQueryString('?search=transaction-op-5');
      await pageloadTestSetup();

      const searchInput = await screen.findByPlaceholderText('Search in trace');
      expect(searchInput).toHaveValue('transaction-op-5');

      await waitFor(() => {
        expect(screen.getByTestId('trace-search-result-iterator')).toHaveTextContent(
          '1/1'
        );
      });
    });

    it('triggers search on load but does not steal focus from node param', async () => {
      mockQueryString('?search=transaction-op-999&node=txn-0');

      const {virtualizedContainer} = await pageloadTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      expect(searchInput).toHaveValue('transaction-op-999');

      await waitFor(() => {
        expect(screen.getByTestId('trace-search-result-iterator')).toHaveTextContent(
          '-/1'
        );
      });

      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(rows[1]).toHaveFocus();
    });

    it('if search on load does not match anything, it does not steal focus or highlight first result', async () => {
      mockQueryString('?search=dead&node=txn-5');

      const {container} = await pageloadTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      expect(searchInput).toHaveValue('dead');

      await waitFor(() => {
        expect(screen.getByTestId('trace-search-result-iterator')).toHaveTextContent(
          'no results'
        );
      });

      const rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(rows[6]).toHaveFocus();
    });
  });

  describe('keyboard navigation', () => {
    it('arrow down', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await userEvent.click(rows[0]);
      await waitFor(() => expect(rows[0]).toHaveFocus());

      await userEvent.keyboard('{arrowdown}');
      await waitFor(() => expect(rows[1]).toHaveFocus());
    });
    it('arrow up', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await userEvent.click(rows[1]);
      await waitFor(() => expect(rows[1]).toHaveFocus());

      await userEvent.keyboard('{arrowup}');
      await waitFor(() => expect(rows[0]).toHaveFocus());
    });
    // biome-ignore lint/suspicious/noSkippedTests: Flaky test
    it.skip('arrow right expands row and fetches data', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      mockSpansResponse(
        '0',
        {},
        {
          entries: [
            {type: EntryType.SPANS, data: [makeSpan({span_id: '0', op: 'special-span'})]},
          ],
        }
      );
      await userEvent.click(rows[1]);
      await waitFor(() => expect(rows[1]).toHaveFocus());

      await userEvent.keyboard('{arrowright}');
      expect(await screen.findByText('special-span')).toBeInTheDocument();
    });

    it('arrow left collapses row', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      const request = mockSpansResponse(
        '0',
        {},
        {
          entries: [
            {type: EntryType.SPANS, data: [makeSpan({span_id: '0', op: 'special-span'})]},
          ],
        }
      );
      await userEvent.click(rows[1]);
      await waitFor(() => expect(rows[1]).toHaveFocus());

      await userEvent.keyboard('{arrowright}');
      expect(request).toHaveBeenCalledTimes(1);

      expect(await screen.findByText('special-span')).toBeInTheDocument();
      await userEvent.keyboard('{arrowleft}');
      expect(screen.queryByText('special-span')).not.toBeInTheDocument();
    });

    it('arrow left does not collapse trace root row', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await userEvent.click(rows[0]);
      await waitFor(() => expect(rows[0]).toHaveFocus());

      await userEvent.keyboard('{arrowleft}');
      expect(await screen.findByText('transaction-name-1')).toBeInTheDocument();
    });

    it('arrow left on transaction row still renders transaction children', async () => {
      const {virtualizedContainer} = await nestedTransactionsTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await userEvent.click(rows[1]);
      await waitFor(() => expect(rows[1]).toHaveFocus());

      await userEvent.keyboard('{arrowleft}');
      expect(await screen.findByText('transaction-name-2')).toBeInTheDocument();
    });

    it('roving updates the element in the drawer', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      mockSpansResponse(
        '0',
        {},
        {
          entries: [
            {type: EntryType.SPANS, data: [makeSpan({span_id: '0', op: 'special-span'})]},
          ],
        }
      );

      await userEvent.click(rows[1]);
      await waitFor(() => expect(rows[1]).toHaveFocus());

      expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
        'transaction-op-0'
      );

      await userEvent.keyboard('{arrowright}');
      expect(await screen.findByText('special-span')).toBeInTheDocument();
      await userEvent.keyboard('{arrowdown}');
      await waitFor(() => {
        const updatedRows = virtualizedContainer.querySelectorAll(
          VISIBLE_TRACE_ROW_SELECTOR
        );
        expect(updatedRows[2]).toHaveFocus();
      });

      expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
        'special-span'
      );
    });

    it('arrowup on first node jumps to end', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      await userEvent.click(rows[0]);

      await waitFor(() => expect(rows[0]).toHaveFocus());
      await userEvent.keyboard('{arrowup}');

      expect(
        await findByText(virtualizedContainer, /transaction-op-9999/i)
      ).toBeInTheDocument();

      await waitFor(() => {
        rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[rows.length - 1]).toHaveFocus();
      });
    });

    it('arrowdown on last node jumps to start', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      await userEvent.click(rows[0]);
      await waitFor(() => expect(rows[0]).toHaveFocus());

      await userEvent.keyboard('{arrowup}', {delay: null});
      await waitFor(() => {
        rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[rows.length - 1]).toHaveFocus();
      });
      expect(
        await within(virtualizedContainer).findByText(/transaction-op-9999/i)
      ).toBeInTheDocument();

      await userEvent.keyboard('{arrowdown}', {delay: null});
      await waitFor(() => {
        rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[0]).toHaveFocus();
      });
      expect(
        await within(virtualizedContainer).findByText(/transaction-op-0/i)
      ).toBeInTheDocument();
    });
    it('tab scrolls to next node', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      await userEvent.click(rows[0]);

      await waitFor(() => expect(rows[0]).toHaveFocus());
      await userEvent.keyboard('{tab}');

      await waitFor(() => {
        rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[1]).toHaveFocus();
      });
    });
    it('shift+tab scrolls to previous node', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      await userEvent.click(rows[1]);

      await waitFor(() => expect(rows[1]).toHaveFocus());
      await userEvent.keyboard('{Shift>}{tab}{/Shift}');

      await waitFor(() => {
        rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[0]).toHaveFocus();
      });
    });
    it('arrowdown+shift scrolls to the end of the list', async () => {
      const {container, virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      await userEvent.click(rows[0]);

      await waitFor(() => expect(rows[0]).toHaveFocus());
      await userEvent.keyboard('{Shift>}{arrowdown}{/Shift}');

      expect(
        await findByText(virtualizedContainer, /transaction-op-9999/i)
      ).toBeInTheDocument();
      await waitFor(() => {
        rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[rows.length - 1]).toHaveFocus();
      });
    });

    it('arrowup+shift scrolls to the start of the list', async () => {
      const {container, virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      await userEvent.click(rows[0]);

      await waitFor(() => expect(rows[0]).toHaveFocus());
      await userEvent.keyboard('{Shift>}{arrowdown}{/Shift}');

      expect(
        await findByText(virtualizedContainer, /transaction-op-9999/i)
      ).toBeInTheDocument();

      await waitFor(() => {
        rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[rows.length - 1]).toHaveFocus();
      });

      await userEvent.keyboard('{Shift>}{arrowup}{/Shift}');
      expect(
        await findByText(virtualizedContainer, /transaction-op-0/i)
      ).toBeInTheDocument();
      await scrollToEnd();
      await waitFor(() => {
        rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[0]).toHaveFocus();
      });
    });
  });

  describe('search', () => {
    it('searches in transaction', async () => {
      const {container} = await searchTestSetup();
      let rows = Array.from(container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR));

      const searchInput = await screen.findByPlaceholderText('Search in trace');

      await userEvent.click(searchInput);
      fireEvent.change(searchInput, {target: {value: 'transaction-op'}});

      await waitFor(() => {
        const highlighted_row = container.querySelector(
          '.TraceRow:not(.Hidden).SearchResult.Highlight'
        );

        rows = Array.from(container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR));
        expect(rows.indexOf(highlighted_row!)).toBe(1);
      });
    });

    it('supports roving with arrowup and arrowdown', async () => {
      const {container} = await searchTestSetup();

      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);
      // Fire change because userEvent triggers this letter by letter
      fireEvent.change(searchInput, {target: {value: 'transaction-op'}});

      // Wait for the search results to resolve
      await searchToUpdate();

      for (const action of [
        // starting at the top, jumpt bottom with shift+arrowdown
        ['{Shift>}{arrowdown}{/Shift}', 11],
        // // move to row above with arrowup
        ['{arrowup}', 10],
        // // and jump back to top with shift+arrowup
        ['{Shift>}{arrowup}{/Shift}', 1],
        // // // and jump to next row with arrowdown
        ['{arrowdown}', 2],
      ] as const) {
        await userEvent.keyboard(action[0] as string);
        // assert that focus on search input is never lost
        expect(searchInput).toHaveFocus();

        await waitFor(() => {
          // Only a single row is highlighted, the rest are search results
          assertHighlightedRowAtIndex(container, action[1]);
        });
      }
    });

    it('search roving updates the element in the drawer', async () => {
      await searchTestSetup();

      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);
      // Fire change because userEvent triggers this letter by letter
      fireEvent.change(searchInput, {target: {value: 'transaction-op'}});

      // Wait for the search results to resolve
      await searchToUpdate();

      expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
        'transaction-op-0'
      );

      // assert that focus on search input is never lost
      expect(searchInput).toHaveFocus();
      await userEvent.keyboard('{arrowdown}');

      await waitFor(() => {
        expect(screen.getByTestId('trace-drawer-title')).toHaveTextContent(
          'transaction-op-1'
        );
      });
    });
    it('highlighted node narrows down on the first result', async () => {
      const {container} = await searchTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);
      // Fire change because userEvent triggers this letter by letter
      fireEvent.change(searchInput, {target: {value: 'transaction-op-1'}});

      // Wait for the search results to resolve
      await searchToUpdate();

      assertHighlightedRowAtIndex(container, 2);

      fireEvent.change(searchInput, {target: {value: 'transaction-op-10'}});
      await searchToUpdate();

      await waitFor(() => {
        assertHighlightedRowAtIndex(container, 11);
      });
    });
    it('highlighted is persisted on node while it is part of the search results', async () => {
      const {container} = await searchTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);
      // Fire change because userEvent triggers this letter by letter
      fireEvent.change(searchInput, {target: {value: 'trans'}});

      // Wait for the search results to resolve
      await searchToUpdate();

      await userEvent.keyboard('{arrowdown}');
      await searchToUpdate();

      assertHighlightedRowAtIndex(container, 2);

      fireEvent.change(searchInput, {target: {value: 'transa'}});
      await searchToUpdate();

      // Highlighting is persisted on the row
      assertHighlightedRowAtIndex(container, 2);

      fireEvent.change(searchInput, {target: {value: 'this wont match anything'}});
      await searchToUpdate();

      // When there is no match, the highlighting is removed
      expect(container.querySelectorAll('.TraceRow.Highlight')).toHaveLength(0);
    });

    it('auto highlights the first result when search begins', async () => {
      const {container} = await searchTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);

      // Nothing is highlighted
      expect(container.querySelectorAll('.TraceRow.Highlight')).toHaveLength(0);
      // Fire change because userEvent triggers this letter by letter
      fireEvent.change(searchInput, {target: {value: 't'}});

      // Wait for the search results to resolve
      await searchToUpdate();

      assertHighlightedRowAtIndex(container, 1);
    });
    it('clicking a row that is also a search result updates the result index', async () => {
      const {container} = await searchTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);
      // Fire change because userEvent triggers this letter by letter
      fireEvent.change(searchInput, {target: {value: 'transaction-op-1'}});

      await searchToUpdate();

      assertHighlightedRowAtIndex(container, 2);
      const rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      // By default, we highlight the first result
      expect(await screen.findByTestId('trace-search-result-iterator')).toHaveTextContent(
        '1/2'
      );
      await scrollToEnd();
      // Click on a random row in the list that is not a search result
      await userEvent.click(rows[5]);
      await waitFor(() => {
        expect(screen.queryByTestId('trace-search-result-iterator')).toHaveTextContent(
          '-/2'
        );
      });
      await scrollToEnd();
      // Click on a the row in the list that is a search result
      await userEvent.click(rows[2]);
      await waitFor(() => {
        expect(screen.queryByTestId('trace-search-result-iterator')).toHaveTextContent(
          '1/2'
        );
      });
    });
    it('during search, expanding a row retriggers search', async () => {
      mockTraceRootFacets();
      mockTraceRootEvent('0');
      mockTraceEventDetails();
      mockMetricsResponse();

      mockTraceResponse({
        body: {
          transactions: [
            makeTransaction({
              span_id: '0',
              event_id: '0',
              transaction: 'transaction-name-0',
              'transaction.op': 'transaction-op-0',
              project_slug: 'project_slug',
            }),
            makeTransaction({
              span_id: '1',
              event_id: '1',
              transaction: 'transaction-name-1',
              'transaction.op': 'transaction-op-1',
              project_slug: 'project_slug',
            }),
            makeTransaction({
              span_id: '2',
              event_id: '2',
              transaction: 'transaction-name-2',
              'transaction.op': 'transaction-op-2',
              project_slug: 'project_slug',
            }),
            makeTransaction({
              span_id: '3',
              event_id: '3',
              transaction: 'transaction-name-3',
              'transaction.op': 'transaction-op-3',
              project_slug: 'project_slug',
            }),
          ],
          orphan_errors: [],
        },
      });

      mockTraceMetaResponse({
        body: {
          errors: 0,
          performance_issues: 0,
          projects: 0,
          transactions: 0,
          transaction_child_count_map: [
            {
              'transaction.id': '0',
              count: 5,
            },
            {
              'transaction.id': '1',
              count: 5,
            },
            {
              'transaction.id': '2',
              count: 5,
            },
            {
              'transaction.id': '3',
              count: 5,
            },
          ],
        },
      });

      const spansRequest = mockSpansResponse(
        '0',
        {},
        {
          entries: [
            {
              type: EntryType.SPANS,
              data: [
                makeSpan({span_id: '0', description: 'span-description', op: 'op-0'}),
              ],
            },
          ],
        }
      );

      const value = render(<TraceView />, {router});

      // Awaits for the placeholder rendering rows to be removed
      expect(await findByText(value.container, /transaction-op-0/i)).toBeInTheDocument();

      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);
      // Fire change because userEvent triggers this letter by letter
      fireEvent.change(searchInput, {target: {value: 'op-0'}});
      await searchToUpdate();

      expect(await screen.findByTestId('trace-search-result-iterator')).toHaveTextContent(
        '1/1'
      );

      const highlighted_row = value.container.querySelector(ACTIVE_SEARCH_HIGHLIGHT_ROW);
      const open = await screen.findAllByRole('button', {name: '+'});
      await userEvent.click(open[0]);
      expect(await screen.findByText('span-description')).toBeInTheDocument();
      await searchToUpdate();

      expect(spansRequest).toHaveBeenCalled();

      // The search is retriggered, but highlighting of current row is preserved
      expect(value.container.querySelector(ACTIVE_SEARCH_HIGHLIGHT_ROW)).toBe(
        highlighted_row
      );
      expect(await screen.findByTestId('trace-search-result-iterator')).toHaveTextContent(
        '1/2'
      );
    });

    it('during search, highlighting is persisted on the row', async () => {
      const {container} = await searchTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);
      // Fire change because userEvent triggers this letter by letter
      fireEvent.change(searchInput, {target: {value: 'transaction-op'}});
      await searchToUpdate();

      assertHighlightedRowAtIndex(container, 1);
      await searchToUpdate();

      // User moves down the list using keyboard navigation
      for (const _ of [1, 2, 3, 4, 5]) {
        const initial = screen.getByTestId('trace-search-result-iterator').textContent;
        await userEvent.keyboard('{arrowDown}');
        await waitFor(() => {
          expect(screen.getByTestId('trace-search-result-iterator')).not.toBe(initial);
        });
      }

      // User clicks on an entry in the list, then proceeds to search
      await waitFor(() => {
        expect(screen.getByTestId('trace-search-result-iterator')).toHaveTextContent(
          '6/11'
        );
      });
      // And then continues the query - the highlighting is preserved as long as the
      // rwo is part of the search results
      assertHighlightedRowAtIndex(container, 6);
      fireEvent.change(searchInput, {target: {value: 'transaction-op-'}});
      await searchToUpdate();
      assertHighlightedRowAtIndex(container, 6);
      fireEvent.change(searchInput, {target: {value: 'transaction-op-5'}});
      await searchToUpdate();
      assertHighlightedRowAtIndex(container, 6);
      fireEvent.change(searchInput, {target: {value: 'transaction-op-none'}});
      await searchToUpdate();
      expect(container.querySelectorAll('.TraceRow.Highlight')).toHaveLength(0);
    });
  });

  describe('tabbing', () => {
    beforeEach(() => {});
    afterEach(() => {
      jest.restoreAllMocks();
    });
    it('clicking on a node spawns a new tab when none is selected', async () => {
      const {virtualizedContainer} = await simpleTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);
      await userEvent.click(rows[5]);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
      });
    });

    it('clicking on a node replaces the previously selected tab', async () => {
      const {virtualizedContainer} = await simpleTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);

      await userEvent.click(rows[5]);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
        expect(
          screen
            .queryAllByTestId(DRAWER_TABS_TEST_ID)[1]
            .textContent?.includes('transaction-op-4')
        ).toBeTruthy();
      });

      await userEvent.click(rows[7]);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
        expect(
          screen
            .queryAllByTestId(DRAWER_TABS_TEST_ID)[1]
            .textContent?.includes('transaction-op-6')
        ).toBeTruthy();
      });
    });
    it('pinning a tab and clicking on a new node spawns a new tab', async () => {
      const {virtualizedContainer} = await simpleTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);

      await userEvent.click(rows[5]);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
      });

      await userEvent.click(await screen.findByTestId(DRAWER_TABS_PIN_BUTTON_TEST_ID));
      await userEvent.click(rows[7]);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(3);
        expect(
          screen
            .queryAllByTestId(DRAWER_TABS_TEST_ID)[1]
            .textContent?.includes('transaction-op-4')
        ).toBeTruthy();
        expect(
          screen
            .queryAllByTestId(DRAWER_TABS_TEST_ID)[2]
            .textContent?.includes('transaction-op-6')
        ).toBeTruthy();
      });
    });
    it('unpinning a tab removes it', async () => {
      const {virtualizedContainer} = await simpleTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);

      await userEvent.click(rows[5]);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
      });

      await userEvent.click(await screen.findByTestId(DRAWER_TABS_PIN_BUTTON_TEST_ID));
      await userEvent.click(rows[7]);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(3);
      });

      const tabButtons = screen.queryAllByTestId(DRAWER_TABS_PIN_BUTTON_TEST_ID);
      expect(tabButtons).toHaveLength(2);

      await userEvent.click(tabButtons[0]);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
      });
    });
    it('clicking a node that is already open in a tab switches to that tab and persists the previous node', async () => {
      const {virtualizedContainer} = await simpleTestSetup();
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);

      await userEvent.click(rows[5]);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
      });

      await userEvent.click(await screen.findByTestId(DRAWER_TABS_PIN_BUTTON_TEST_ID));
      await userEvent.click(rows[7]);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(3);
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)[2]).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });

      await userEvent.click(rows[5]);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)[1]).toHaveAttribute(
          'aria-selected',
          'true'
        );
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(3);
      });
    });
  });
});
