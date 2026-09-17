import * as Sentry from '@sentry/react';
import MockDate from 'mockdate';
import {TransactionEventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import * as indicators from 'sentry/actionCreators/indicator';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {EntryType, type EventTransaction} from 'sentry/types/event';
import * as analytics from 'sentry/utils/analytics';
import TraceView from 'sentry/views/performance/newTraceDetails/index';
import {
  makeEAPError,
  makeEAPSpan,
  makeEAPTrace,
  makeEventTransaction,
  makeSpan,
  makeTraceError,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {TraceTimeCompression} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceTimeCompression';
import {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import type {StoredTracePreferences} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

import type {TraceFullDetailed} from './traceApi/types';

class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  unobserve(_element: HTMLElement) {
    return;
  }

  observe(element: HTMLElement) {
    setTimeout(() => {
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
    }, 0);
  }
  disconnect() {}
}

type ResponseType = Parameters<typeof MockApiClient.addMockResponse>[0];

function mockQueryString(queryString: `?${string}` | '') {
  setWindowLocation(
    `http://localhost/organizations/org-slug/performance/trace/trace-id/${queryString}`
  );
  expect(window.location.search).toBe(queryString);
}

function mockTracePreferences(preferences: Partial<StoredTracePreferences>) {
  const storedPreferences: StoredTracePreferences = {
    drawer_layout: DEFAULT_TRACE_VIEW_PREFERENCES.layout,
    missing_instrumentation: DEFAULT_TRACE_VIEW_PREFERENCES.missing_instrumentation,
    autogroup: DEFAULT_TRACE_VIEW_PREFERENCES.autogroup,
    compressed_timeline: DEFAULT_TRACE_VIEW_PREFERENCES.compressed_timeline,
    ...preferences,
  };
  localStorage.setItem('trace-waterfall-preferences', JSON.stringify(storedPreferences));
}

function mockTraceResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace/trace-id/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {body: {}}),
  });
}

function mockPerformanceSubscriptionDetailsResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/customers/org-slug/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {body: {}}),
  });
}

function mockTraceMetaResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-meta/trace-id/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {
      body: {
        errorsCount: 0,
        logsCount: 0,
        metricsCount: 0,
        performanceIssuesCount: 0,
        spansCount: 200,
        spansCountMap: {},
        transactionChildCountMap: [],
        uptimeCount: 0,
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

function mockProjectDetailsResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/projects/org-slug//',
    method: 'GET',
    asyncDelay: 1,
    ...resp,
  });
}

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
    url: '/organizations/org-slug/events-facets/',
    method: 'GET',
    asyncDelay: 1,
    body: {},
    ...resp,
  });
}

function mockTraceEventDetails(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
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
    ...resp,
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
    ...resp,
  });
}

const initialRouterConfig: RouterConfig = {
  location: {
    pathname: '/organizations/org-slug/performance/trace/trace-id/',
    query: {},
  },
  route: '/organizations/:orgId/performance/trace/:traceSlug/',
};

function mockEventsResponse() {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
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

function getVirtualizedRows(container: HTMLElement) {
  return Array.from(container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR));
}

async function keyboardNavigationTestSetup() {
  mockPerformanceSubscriptionDetailsResponse();
  mockProjectDetailsResponse();
  const keyboard_navigation_transactions: TraceFullDetailed[] = [];
  for (let i = 0; i < 1e2; i++) {
    keyboard_navigation_transactions.push(
      makeTransaction({
        span_id: i + '',
        event_id: i + '',
        transaction: 'transaction-name-' + i,
        'transaction.op': 'transaction-op-' + i,
        project_slug: 'project_slug',
      })
    );
    mockTransactionDetailsResponse(`${i}`);
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
      span_count: 200,
      span_count_map: {},
    },
  });
  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockEventsResponse();

  const value = render(<TraceView />, {
    initialRouterConfig,
  });
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  try {
    await within(virtualizedContainer).findAllByText(/transaction-op-/i, undefined, {
      timeout: 5000,
    });
  } catch (e) {
    printVirtualizedList(virtualizedContainer);
    throw e;
  }
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

async function pageloadTestSetup() {
  mockPerformanceSubscriptionDetailsResponse();
  mockProjectDetailsResponse();
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

    mockTransactionDetailsResponse(`${i}`);
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
      span_count: 200,
      span_count_map: {},
    },
  });
  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockEventsResponse();

  const value = render(<TraceView />, {
    initialRouterConfig,
  });
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  try {
    await within(virtualizedContainer).findAllByText(/transaction-op-/i, undefined, {
      timeout: 5000,
    });
  } catch (e) {
    printVirtualizedList(virtualizedContainer);
    throw e;
  }
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

async function nestedTransactionsTestSetup() {
  mockPerformanceSubscriptionDetailsResponse();
  mockProjectDetailsResponse();
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

    mockTransactionDetailsResponse(`${i}`);
  }

  mockTraceResponse({
    body: {
      transactions,
      orphan_errors: [],
    },
  });
  mockTraceMetaResponse();
  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockEventsResponse();

  const value = render(<TraceView />, {
    initialRouterConfig,
  });
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  try {
    await within(virtualizedContainer).findAllByText(/transaction-op-/i, undefined, {
      timeout: 5000,
    });
  } catch (e) {
    printVirtualizedList(virtualizedContainer);
    throw e;
  }
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

async function searchTestSetup() {
  mockPerformanceSubscriptionDetailsResponse();
  mockProjectDetailsResponse();
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
    mockTransactionDetailsResponse(`${i}`);
  }
  mockTraceResponse({
    body: {
      transactions,
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
      span_count: 200,
      span_count_map: {},
    },
  });

  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockEventsResponse();

  const value = render(<TraceView />, {
    initialRouterConfig,
  });
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  try {
    await within(virtualizedContainer).findAllByText(/transaction-op-/i, undefined, {
      timeout: 5000,
    });
  } catch (e) {
    printVirtualizedList(virtualizedContainer);
    throw e;
  }
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

async function simpleTestSetup() {
  mockPerformanceSubscriptionDetailsResponse();
  mockProjectDetailsResponse();
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
    mockTransactionDetailsResponse(`${i}`);
  }
  mockTraceResponse({
    body: {
      transactions,
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
      span_count: 200,
      span_count_map: {},
    },
  });
  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockEventsResponse();

  const value = render(<TraceView />, {
    initialRouterConfig,
  });
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  try {
    await within(virtualizedContainer).findAllByText(/transaction-op-/i, undefined, {
      timeout: 5000,
    });
  } catch (e) {
    printVirtualizedList(virtualizedContainer);
    throw e;
  }
  return {...value, virtualizedContainer, virtualizedScrollContainer};
}

async function completeTestSetup({
  organization,
  rootMeasurements,
}: {
  organization?: ReturnType<typeof OrganizationFixture>;
  rootMeasurements?: TraceFullDetailed['measurements'];
} = {}) {
  mockPerformanceSubscriptionDetailsResponse();
  mockProjectDetailsResponse();
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
          measurements: rootMeasurements,
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
      span_count: 200,
      span_count_map: {},
    },
  });
  mockTraceRootFacets();
  mockTraceRootEvent('0');
  mockTraceEventDetails();
  mockEventsResponse();

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
          // No instrumentation gap
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

  const value = render(<TraceView />, {
    initialRouterConfig,
    organization,
  });
  const virtualizedContainer = getVirtualizedContainer();
  const virtualizedScrollContainer = getVirtualizedScrollContainer();

  // Awaits for the placeholder rendering rows to be removed
  try {
    await within(virtualizedContainer).findAllByText(/transaction-op-/i, undefined, {
      timeout: 5000,
    });
  } catch (e) {
    printVirtualizedList(virtualizedContainer);
    throw e;
  }
  return {...value, start, virtualizedContainer, virtualizedScrollContainer};
}

const DRAWER_TABS_TEST_ID = 'trace-drawer-tab';
const DRAWER_TABS_PIN_BUTTON_TEST_ID = 'trace-drawer-tab-pin-button';
const VISIBLE_TRACE_ROW_SELECTOR = '.TraceRow:not(.Hidden)';
const ACTIVE_SEARCH_HIGHLIGHT_ROW = '.TraceRow.SearchResult.Highlight:not(.Hidden)';

const searchToResolve = async (): Promise<void> => {
  await screen.findByTestId('trace-search-success', undefined, {timeout: 10_000});
};

function printVirtualizedList(container: HTMLElement) {
  const stdout: string[] = [];
  const scrollContainer = screen.queryByTestId(
    'trace-virtualized-list-scroll-container'
  )!;

  const rows = Array.from(container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR));
  const searchResultIterator = screen.queryByTestId('trace-search-result-iterator');
  // https://github.com/typescript-eslint/typescript-eslint/issues/10722
  // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
  const searchInput = screen.queryByPlaceholderText(
    'Search in trace'
  ) as HTMLInputElement;
  const loading = screen.queryByTestId('trace-search-loading');
  const success = screen.queryByTestId('trace-search-success');

  stdout.push(
    'Debug Information: ' +
      'Rows=' +
      rows.length +
      ' ' +
      'Search Query:' +
      (searchInput?.value || '<empty>') +
      ' ' +
      (searchResultIterator?.textContent || '<empty>') +
      ' ' +
      'Search Status:' +
      (loading ? 'loading' : success ? 'success' : '<empty>') +
      ' ' +
      'Scroll=' +
      'top:' +
      scrollContainer.scrollTop +
      ' ' +
      'left:' +
      scrollContainer.scrollLeft +
      ' '
  );

  for (const r of [...rows]) {
    const count = r.querySelector('.TraceChildrenCount')?.textContent;
    const op = r.querySelector('.TraceOperation')?.textContent;
    const desc = r.querySelector('.TraceDescription')?.textContent;
    let t = (count ?? '') + ' ' + (op ?? '') + ' — ' + (desc ?? '');

    if (r.classList.contains('SearchResult')) {
      t = t + ' search';
    }
    if (r.classList.contains('Highlight')) {
      t = t + ' highlight';
    }

    if (document.activeElement === r) {
      t = t + ' ⬅ focused ';
    }

    // https://github.com/typescript-eslint/typescript-eslint/issues/10722
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    const leftColumn = r.querySelector('.TraceLeftColumnInner') as HTMLElement;
    const left = Math.round(Number.parseInt(leftColumn.style.paddingLeft, 10) / 10);

    stdout.push(' '.repeat(left) + t);
  }

  // This is a debug fn, we need it to log
  // eslint-disable-next-line no-console
  console.log(stdout.join('\n'));
}

async function assertHighlightedRowAtIndex(
  virtualizedContainer: HTMLElement,
  index: number
) {
  await waitFor(() => {
    expect(virtualizedContainer.querySelectorAll('.TraceRow.Highlight')).toHaveLength(1);
  });
  await waitFor(() => {
    const highlighted_row = virtualizedContainer.querySelector(
      ACTIVE_SEARCH_HIGHLIGHT_ROW
    );
    const r = Array.from(
      virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR)
    );
    expect(r.indexOf(highlighted_row!)).toBe(index);
  });
}

describe('trace view', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = MockResizeObserver;
    mockQueryString('');
    MockDate.reset();

    const project = ProjectFixture({
      slug: 'project_slug',
      id: '1',
      name: 'project_name',
      isMember: true,
    });

    ProjectsStore.loadInitialData([project]);

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    });
  });
  afterEach(() => {
    mockQueryString('');
    // @ts-expect-error clear mock
    globalThis.ResizeObserver = undefined;
  });

  describe('attribute pinning', () => {
    function setupPinnedTrace(features = ['trace-waterfall-attribute-pinning']) {
      jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(0, 0, 1000, 500));
      const start = Date.now() / 1000;
      const root = makeEAPSpan({
        event_id: 'pin-root',
        event_type: 'span',
        description: 'pinnable root',
        is_transaction: true,
        start_timestamp: start,
        end_timestamp: start + 1,
        children: [
          makeEAPSpan({
            event_id: 'pin-child',
            event_type: 'span',
            description: 'pinnable child',
            start_timestamp: start,
            end_timestamp: start + 0.5,
          }),
        ],
      });
      const organization = OrganizationFixture({features});
      mockPerformanceSubscriptionDetailsResponse();
      mockProjectDetailsResponse();
      mockTraceRootFacets();
      mockEventsResponse();
      const traceRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        body: [root],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace-meta/trace-id/',
        body: {
          errorsCount: 0,
          logsCount: 0,
          metricsCount: 0,
          performanceIssuesCount: 0,
          spansCount: 2,
          spansCountMap: {},
          transactionChildCountMap: [],
        },
      });
      for (const itemId of ['pin-root', 'pin-child']) {
        MockApiClient.addMockResponse({
          url: `/projects/org-slug/project_slug/trace-items/${itemId}/`,
          body: {
            itemId,
            links: null,
            meta: {},
            timestamp: new Date(start * 1000).toISOString(),
            attributes: [
              {name: 'custom.region', type: 'str', value: 'drawer-region'},
              {name: 'tags[custom.size,number]', type: 'int', value: 0},
              {name: 'tags[custom.enabled,boolean]', type: 'bool', value: false},
            ],
          },
        });
      }
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/logs/',
        body: {data: []},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [],
      });
      function renderTrace(query: Record<string, string> = {}) {
        mockQueryString(
          Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''
        );
        return render(<TraceView />, {
          organization,
          initialRouterConfig: {
            ...initialRouterConfig,
            location: {
              pathname: '/organizations/org-slug/performance/trace/trace-id/',
              query,
            },
          },
        });
      }
      return {root, traceRequest, renderTrace};
    }

    async function openAttributeMenu(attribute: string) {
      const key = await screen.findByTestId(`tree-key-${attribute}`);
      const row = key.closest<HTMLElement>('[data-test-id="attribute-tree-row"]')!;
      await userEvent.click(
        within(row).getByRole('button', {name: 'Attribute Actions Menu'})
      );
    }

    function pinnedCell(description: string) {
      const waterfall = within(screen.getByTestId('trace-virtualized-list'));
      const row = waterfall.getByText(description).closest<HTMLElement>('.TraceRow')!;
      return within(row.querySelector<HTMLElement>('.TracePinnedAttributeCell')!);
    }

    it('shows loaded values and missing attributes while later pages are pending', async () => {
      const {renderTrace, root} = setupPinnedTrace();
      const unloadedChild = makeEAPSpan({
        event_id: 'unloaded-child',
        event_type: 'span',
        description: 'unloaded child',
        start_timestamp: root.start_timestamp,
        end_timestamp: root.end_timestamp,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        body: [{...root, children: [...root.children, unloadedChild]}],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [
          MockApiClient.matchQuery({
            field: ['span_id', 'custom.region'],
            cursor: undefined,
          }),
        ],
        body: {
          data: [
            {span_id: root.event_id, 'custom.region': 'root-region'},
            {span_id: root.children[0]!.event_id, 'custom.region': null},
          ],
        },
        headers: {
          Link: '<https://sentry.io/api/0/organizations/org-slug/events/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
        },
      });
      const nextPage = Promise.withResolvers<void>();
      const nextRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
        asyncDelay: nextPage.promise,
        body: {data: [{span_id: unloadedChild.event_id, 'custom.region': 0}]},
      });
      renderTrace({pinnedAttribute: 'custom.region'});

      expect(await screen.findByText('root-region')).toBeInTheDocument();
      await waitFor(() => expect(nextRequest).toHaveBeenCalled());
      expect(
        pinnedCell('pinnable root').getByRole('button', {name: 'Copy attribute value'})
      ).toBeEnabled();
      expect(pinnedCell('pinnable child').getByText('—')).toBeInTheDocument();
      expect(
        pinnedCell('pinnable child').queryByTestId('loading-indicator')
      ).not.toBeInTheDocument();
      expect(
        pinnedCell('unloaded child').getByTestId('loading-indicator')
      ).toBeInTheDocument();

      act(() => nextPage.resolve());
      expect(await pinnedCell('unloaded child').findByText('0')).toBeInTheDocument();
    });

    it('keeps pinned values loaded when navigating from an error deep link', async () => {
      const {renderTrace, root} = setupPinnedTrace();
      const errors = [
        makeEAPError({
          event_id: '11111111111141118111111111111111',
          description: 'first selectable error',
          start_timestamp: root.start_timestamp + 0.25,
        }),
        makeEAPError({
          event_id: '22222222222242228222222222222222',
          description: 'second selectable error',
          start_timestamp: root.start_timestamp + 0.5,
        }),
      ];
      const traceRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        body: [root, ...errors],
      });
      const attributeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        asyncDelay: 100,
        body: {data: [{span_id: root.event_id, 'custom.region': 'waterfall-region'}]},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/',
        body: GroupFixture(),
      });
      const query = {
        pinnedAttribute: 'custom.region',
        eventId: errors[0]!.event_id,
      };
      const {router} = renderTrace(query);
      expect(await screen.findByText('waterfall-region')).toBeInTheDocument();
      const waterfall = within(screen.getByTestId('trace-virtualized-list'));

      for (const item of [root, ...errors, root]) {
        const description = waterfall.getByText(item.description!);
        // Deep links animate the waterfall before enabling pointer interaction.
        await waitFor(() =>
          expect(screen.getByTestId('trace-virtualized-list')).not.toHaveStyle({
            pointerEvents: 'none',
          })
        );
        await userEvent.click(description);
        await waitFor(() =>
          expect(router.location.query.node).toBe(`${item.event_type}-${item.event_id}`)
        );
        expect(attributeRequest).toHaveBeenCalledTimes(1);
        expect(waterfall.getByText('waterfall-region')).toBeInTheDocument();
      }

      expect(traceRequest).toHaveBeenCalledTimes(1);
      expect(attributeRequest.mock.calls[0]![1].query).toMatchObject({
        dataset: 'spans',
        field: ['span_id', 'custom.region'],
        query: 'trace:trace-id',
        project: -1,
        sampling: 'HIGHEST_ACCURACY',
      });
      expect(attributeRequest.mock.calls[0]![1].query).not.toHaveProperty('errorId');
    });

    it.each(['first', 'next'])(
      'keeps the trace usable and retries a failed %s events page',
      async failedPage => {
        const {renderTrace, root, traceRequest} = setupPinnedTrace();
        const firstPage = {
          url: '/organizations/org-slug/events/',
          match: [
            MockApiClient.matchQuery({
              field: ['span_id', 'custom.region'],
              cursor: undefined,
            }),
          ],
          body: {data: [{span_id: root.event_id, 'custom.region': 'root-region'}]},
          headers: {
            Link: '<https://sentry.io/api/0/organizations/org-slug/events/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
          },
        };
        const nextPage = {
          url: '/organizations/org-slug/events/',
          match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
          body: {
            data: [
              {span_id: root.children[0]!.event_id, 'custom.region': 'child-region'},
            ],
          },
        };
        MockApiClient.addMockResponse(firstPage);
        MockApiClient.addMockResponse(nextPage);
        const failedResponse = failedPage === 'first' ? firstPage : nextPage;
        const failedRequest = MockApiClient.addMockResponse({
          ...failedResponse,
          statusCode: 500,
        });
        const {router} = renderTrace({pinnedAttribute: 'custom.region'});

        expect(await screen.findByText('Could not load attribute')).toBeInTheDocument();
        expect(failedRequest).toHaveBeenCalledTimes(1);
        expect(pinnedCell('pinnable child').getByText('—')).toBeInTheDocument();
        if (failedPage === 'next') {
          expect(screen.getByText('root-region')).toBeInTheDocument();
          expect(
            pinnedCell('pinnable root').getByRole('button', {
              name: 'Copy attribute value',
            })
          ).toBeEnabled();
        }
        await userEvent.click(screen.getByText('pinnable root'));
        await waitFor(() => expect(router.location.query.node).toBe('span-pin-root'));

        const retry = Promise.withResolvers<void>();
        MockApiClient.addMockResponse({...failedResponse, asyncDelay: retry.promise});
        await userEvent.click(
          screen.getByRole('button', {name: 'Retry loading attribute'})
        );
        if (failedPage === 'next') {
          expect(screen.getByText('root-region')).toBeInTheDocument();
          expect(
            pinnedCell('pinnable root').getByRole('button', {
              name: 'Copy attribute value',
            })
          ).toBeEnabled();
        }
        act(() => retry.resolve());

        expect(await screen.findByText('child-region')).toBeInTheDocument();
        expect(screen.getByText('root-region')).toBeInTheDocument();
        expect(screen.queryByText('Could not load attribute')).not.toBeInTheDocument();
        expect(router.location.query.node).toBe('span-pin-root');
        expect(traceRequest).toHaveBeenCalledTimes(1);
      }
    );

    it('waits for the trace to load before showing a shared pin', async () => {
      const {renderTrace, root} = setupPinnedTrace();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        asyncDelay: 500,
        body: [root],
      });
      const attributeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        body: {data: [{span_id: root.event_id, 'custom.region': 'waterfall-region'}]},
      });
      const {router} = renderTrace({pinnedAttribute: 'custom.region'});

      expect(await screen.findByText(/assembling the trace/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Unpin attribute'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('separator', {name: 'Resize tree and attribute columns'})
      ).not.toBeInTheDocument();
      expect(attributeRequest).not.toHaveBeenCalled();
      expect(router.location.query.pinnedAttribute).toBe('custom.region');

      expect(await screen.findByText('waterfall-region')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Unpin attribute'})).toBeInTheDocument();
      expect(attributeRequest).toHaveBeenCalledTimes(1);
      expect(router.location.query.pinnedAttribute).toBe('custom.region');
    });

    it('preserves pinned child values, selection and zoom when expanding an EAP parent', async () => {
      const {renderTrace, root, traceRequest} = setupPinnedTrace();
      const attributeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        body: {
          data: [
            {span_id: root.event_id, 'custom.region': 'root-region'},
            ...root.children.map(child => ({
              span_id: child.event_id,
              'custom.region': 'child-region',
            })),
          ],
        },
      });
      const query = {pinnedAttribute: 'custom.region', fov: '100,500'};
      const {router} = renderTrace(query);
      expect(await screen.findByText('child-region')).toBeInTheDocument();
      const rootDescription = screen.getByText('pinnable root');
      await userEvent.click(rootDescription);
      await waitFor(() => expect(router.location.query.node).toBe('span-pin-root'));
      const rootRow = rootDescription.closest<HTMLElement>('.TraceRow')!;
      const expandButton = within(rootRow).getByRole('button', {name: '1'});

      await userEvent.click(expandButton);
      expect(screen.queryByText('child-region')).not.toBeInTheDocument();
      await userEvent.click(expandButton);

      const childRow = (await screen.findByText('pinnable child')).closest<HTMLElement>(
        '.TraceRow'
      )!;
      expect(within(childRow).getByText('child-region')).toBeInTheDocument();
      expect(within(rootRow).getByText('root-region')).toBeInTheDocument();
      expect(router.location.query.node).toBe('span-pin-root');
      expect(router.location.query.fov).toBe('100,500');
      expect(traceRequest).toHaveBeenCalledTimes(1);
      expect(attributeRequest).toHaveBeenCalledTimes(1);
    });

    it('pins, resizes, replaces and unpins an attribute from the drawer', async () => {
      const {renderTrace, root} = setupPinnedTrace();
      const regionRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        body: {data: [{span_id: root.event_id, 'custom.region': 'waterfall-region'}]},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [
          MockApiClient.matchQuery({field: ['span_id', 'tags[custom.size,number]']}),
        ],
        body: {data: [{span_id: root.event_id, 'tags[custom.size,number]': 0}]},
      });
      const {router} = renderTrace();
      await userEvent.click(await screen.findByText('pinnable root'));
      await waitFor(() => expect(router.location.query.node).toBe('span-pin-root'));
      const nodeBeforePin = router.location.query.node;
      await openAttributeMenu('custom.region');
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Pin to waterfall'})
      );
      expect(await screen.findByText('waterfall-region')).toBeInTheDocument();
      expect(regionRequest).toHaveBeenCalledTimes(1);
      expect(router.location.query.pinnedAttribute).toBe('custom.region');
      expect(
        within(screen.getByTestId('tree-key-custom.region')).getByRole('img', {
          name: 'Pinned attribute',
        })
      ).toBeInTheDocument();
      expect(router.location.query.node).toEqual(nodeBeforePin);
      for (const name of [
        'Resize tree and attribute columns',
        'Resize attribute and timeline columns',
      ]) {
        const divider = screen.getByRole('separator', {name});
        const previousValue = Number(divider.getAttribute('aria-valuenow'));
        divider.focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(Number(divider.getAttribute('aria-valuenow'))).toBeGreaterThan(
          previousValue
        );
      }
      await openAttributeMenu('tags[custom.size,number]');
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Pin to waterfall'})
      );
      await waitFor(() =>
        expect(router.location.query.pinnedAttribute).toBe('tags[custom.size,number]')
      );
      expect(screen.queryByText('waterfall-region')).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('tree-key-custom.region')).queryByRole('img', {
          name: 'Pinned attribute',
        })
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('tree-key-tags[custom.size,number]')).getByRole('img', {
          name: 'Pinned attribute',
        })
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('button', {name: 'Copy attribute value'})
      ).toBeInTheDocument();
      await openAttributeMenu('tags[custom.size,number]');
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Unpin from waterfall'})
      );
      expect(router.location.query.pinnedAttribute).toBeUndefined();
      expect(
        screen.queryByRole('img', {name: 'Pinned attribute'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('separator', {name: 'Resize tree and attribute columns'})
      ).not.toBeInTheDocument();
      expect(router.location.query.node).toEqual(nodeBeforePin);
    });

    it.each([
      {attribute: 'tags[custom.size,number]', value: 0},
      {attribute: 'tags[custom.enabled,boolean]', value: false},
    ])(
      'preserves the typed key for $attribute when pinning and reloading',
      async ({attribute, value}) => {
        const {renderTrace, root} = setupPinnedTrace();
        const attributeRequest = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          match: [MockApiClient.matchQuery({field: ['span_id', attribute]})],
          body: {data: [{span_id: root.event_id, [attribute]: value}]},
        });
        const {router, unmount} = renderTrace();
        await userEvent.click(await screen.findByText('pinnable root'));
        await openAttributeMenu(attribute);
        await userEvent.click(
          await screen.findByRole('menuitemradio', {name: 'Pin to waterfall'})
        );
        expect(
          await within(screen.getByTestId('trace-virtualized-list')).findByText(
            String(value)
          )
        ).toBeInTheDocument();
        expect(router.location.query.pinnedAttribute).toBe(attribute);
        expect(attributeRequest).toHaveBeenCalledTimes(1);

        const query = {pinnedAttribute: attribute};
        unmount();
        renderTrace(query);
        expect(
          await within(screen.getByTestId('trace-virtualized-list')).findByText(
            String(value)
          )
        ).toBeInTheDocument();
      }
    );

    it.each([
      {
        name: 'spans 48 hours apart',
        offset: 0.25,
        duration: 0.5,
        childOffset: 172800,
        endOffset: 172801,
      },
      {
        name: 'a subsecond trace',
        offset: 0.25,
        duration: 0.5,
        childOffset: null,
        endOffset: 1,
      },
      {
        name: 'a zero-duration trace',
        offset: 0,
        duration: 0,
        childOffset: null,
        endOffset: 1,
      },
    ])(
      'queries the complete time range for $name',
      async ({offset, duration, childOffset, endOffset}) => {
        const {renderTrace, root} = setupPinnedTrace();
        const base = Math.floor(Date.now() / 1000) - 5 * 86400;
        const start = base + offset;
        const trace = {
          ...root,
          start_timestamp: start,
          end_timestamp: start + duration,
          children:
            childOffset === null
              ? []
              : [
                  makeEAPSpan({
                    event_id: 'late-child',
                    event_type: 'span',
                    description: 'late child',
                    start_timestamp: start + childOffset,
                    end_timestamp: start + childOffset + duration,
                  }),
                ],
        };
        const traceRequest = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/trace/trace-id/',
          body: [trace],
        });
        const attributeRequest = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
          body: {
            data: [
              {span_id: trace.event_id, 'custom.region': 'root-region'},
              ...trace.children.map(child => ({
                span_id: child.event_id,
                'custom.region': 'late-region',
              })),
            ],
          },
        });
        // The original window is centered between the spans and includes both.
        // Reanchoring it to the first span would exclude the later one.
        const query = {
          pinnedAttribute: 'custom.region',
          timestamp: String(start + (childOffset ?? 0) / 2),
        };
        renderTrace(query);
        expect(await screen.findByText('root-region')).toBeInTheDocument();
        if (childOffset !== null) {
          expect(await screen.findByText('late-region')).toBeInTheDocument();
        }
        expect(attributeRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              start: new Date(base * 1000).toISOString(),
              end: new Date((base + endOffset) * 1000).toISOString(),
            }),
          })
        );
        expect(attributeRequest.mock.calls[0]![1].query).not.toHaveProperty('timestamp');
        expect(attributeRequest.mock.calls[0]![1].query).not.toHaveProperty(
          'statsPeriod'
        );
        expect(traceRequest).toHaveBeenCalledTimes(1);
      }
    );

    it('loads pinned values for a trace found by the wider-range fallback', async () => {
      const {renderTrace, root} = setupPinnedTrace();
      const start = Math.floor(Date.now() / 1000) - 40 * 86400;
      const trace = {
        ...root,
        start_timestamp: start,
        end_timestamp: start + 1,
        children: [],
      };
      const initialRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
        body: [],
      });
      const fallbackRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        match: [MockApiClient.matchQuery({statsPeriod: '90d'})],
        body: [trace],
      });
      const attributeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        body: {data: [{span_id: trace.event_id, 'custom.region': 'older-region'}]},
      });
      const query = {pinnedAttribute: 'custom.region', statsPeriod: '14d'};
      renderTrace(query);
      expect(await screen.findByText('older-region')).toBeInTheDocument();
      expect(initialRequest).toHaveBeenCalledTimes(1);
      expect(fallbackRequest).toHaveBeenCalledTimes(1);
      expect(attributeRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            start: new Date(start * 1000).toISOString(),
            end: new Date((start + 2) * 1000).toISOString(),
          }),
        })
      );
      expect(attributeRequest.mock.calls[0]![1].query).not.toHaveProperty('timestamp');
      expect(attributeRequest.mock.calls[0]![1].query).not.toHaveProperty('statsPeriod');
    });

    it('ignores URL pins and hides controls when the flag is absent', async () => {
      const {renderTrace} = setupPinnedTrace([]);
      const attributeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        body: [],
      });
      renderTrace({pinnedAttribute: 'custom.region'});
      await userEvent.click(await screen.findByText('pinnable root'));
      expect(await screen.findByText('drawer-region')).toBeInTheDocument();
      await openAttributeMenu('custom.region');
      expect(
        await screen.findByRole('menuitemradio', {
          name: 'Copy attribute value to clipboard',
        })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Pin to waterfall'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Unpin from waterfall'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Unpin attribute'})
      ).not.toBeInTheDocument();
      expect(attributeRequest).not.toHaveBeenCalled();
      await userEvent.keyboard('{Escape}');
    });
  });

  it('renders loading state', async () => {
    mockPerformanceSubscriptionDetailsResponse();
    mockProjectDetailsResponse();

    mockTraceResponse({
      asyncDelay: 1000,
      body: {transactions: [], orphan_errors: []},
    });
    mockTraceMetaResponse();
    mockTraceTagsResponse();
    mockEventsResponse();

    render(<TraceView />, {
      initialRouterConfig,
    });
    expect(await screen.findByText(/assembling the trace/i)).toBeInTheDocument();
  });

  it('renders error state if trace fails to load', async () => {
    mockPerformanceSubscriptionDetailsResponse();
    mockProjectDetailsResponse();

    mockTraceResponse({statusCode: 404});
    mockTraceMetaResponse({statusCode: 404});
    mockTraceTagsResponse({statusCode: 404});
    mockEventsResponse();

    render(<TraceView />, {
      initialRouterConfig,
    });
    expect(
      await screen.findByText(/Woof, we failed to load your trace/i)
    ).toBeInTheDocument();
  });

  it('renders empty state for successfully ingested trace', async () => {
    // set timestamp to 12 minutes ago
    const twelveMinutesAgoInSeconds = Math.floor(
      new Date(Date.now() - 12 * 60 * 1000).getTime() / 1000
    );

    mockPerformanceSubscriptionDetailsResponse();
    mockProjectDetailsResponse();

    mockTraceResponse({
      body: {
        transactions: [],
        orphan_errors: [],
      },
    });
    mockTraceMetaResponse();
    mockTraceTagsResponse();
    mockEventsResponse();

    mockQueryString(`?timestamp=${twelveMinutesAgoInSeconds.toString()}`);
    render(<TraceView />, {
      initialRouterConfig,
    });
    expect(
      await screen.findByText(
        /We were unable to find any spans for this trace\. If you came here from Logs or Application Metrics/i
      )
    ).toBeInTheDocument();
  });

  it('renders empty state for yet to be ingested trace', async () => {
    // set timestamp to 1 minute ago
    const oneMinuteAgoInSeconds = Math.floor(
      new Date(Date.now() - 1 * 60 * 1000).getTime() / 1000
    );

    mockPerformanceSubscriptionDetailsResponse();
    mockProjectDetailsResponse();

    mockTraceResponse({
      body: {
        transactions: [],
        orphan_errors: [],
      },
    });
    mockTraceMetaResponse();
    mockTraceTagsResponse();
    mockEventsResponse();

    mockQueryString(`?timestamp=${oneMinuteAgoInSeconds.toString()}`);
    render(<TraceView />, {
      initialRouterConfig,
    });
    expect(
      await screen.findByText(
        /We're still processing this trace. Please try refreshing after a minute/i
      )
    ).toBeInTheDocument();
  });

  it('does not render the summary tab even when the legacy feature flag is enabled', async () => {
    const organization = OrganizationFixture({features: ['single-trace-summary']});

    await completeTestSetup({organization});

    expect(await screen.findByRole('tab', {name: 'Waterfall'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Summary'})).not.toBeInTheDocument();
  });

  it('selects and zooms to a vital pill source node on click', async () => {
    const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const zoomSpy = jest.spyOn(VirtualizedViewManager.prototype, 'onZoomIntoSpace');
    const {start} = await completeTestSetup({
      rootMeasurements: {lcp: {value: 500, unit: 'millisecond'}},
    });
    const vitalPill = (await screen.findAllByText('LCP')).find(element =>
      element.classList.contains('TraceIndicatorLabel')
    );

    expect(vitalPill).toBeDefined();
    analyticsSpy.mockClear();
    zoomSpy.mockClear();

    await userEvent.click(vitalPill!);

    expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
      'TransactionID: 0'
    );
    expect(analyticsSpy).toHaveBeenCalledWith('trace.trace_layout.zoom_to_fill', {
      organization: expect.objectContaining({slug: 'org-slug'}),
    });
    expect(zoomSpy).toHaveBeenCalledWith([start * 1e3, 525], {padding: false});
  });

  it('selects and zooms to a summary vital pill source node on click', async () => {
    const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const zoomSpy = jest.spyOn(VirtualizedViewManager.prototype, 'onZoomIntoSpace');
    const {start} = await completeTestSetup({
      rootMeasurements: {lcp: {value: 500, unit: 'millisecond'}},
    });
    mockTransactionDetailsResponse('2');
    await userEvent.click(await screen.findByText('transaction-name-2'));
    expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
      'TransactionID: 2'
    );

    const vitalPill = await screen.findByRole('button', {name: /LCP/});

    analyticsSpy.mockClear();
    zoomSpy.mockClear();

    await userEvent.click(vitalPill);

    expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
      'TransactionID: 0'
    );
    expect(analyticsSpy).toHaveBeenCalledWith('trace.trace_layout.zoom_to_fill', {
      organization: expect.objectContaining({slug: 'org-slug'}),
    });
    expect(zoomSpy).toHaveBeenCalledWith([start * 1e3, 525], {padding: false});
    expect(window.location.search).not.toContain('zoomToNode');
    expect(window.location.search).not.toContain('zoomToTimestamp');
    expect(window.location.search).not.toContain('zoomToVital');
  });

  it('reveals a hidden vital pill source node on click', async () => {
    const start = Date.now() / 1e3;
    const organization = OrganizationFixture();
    const vitalSpanDescription = 'standalone LCP span';

    mockPerformanceSubscriptionDetailsResponse();
    mockProjectDetailsResponse();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace/trace-id/',
      body: makeEAPTrace([
        makeEAPSpan({
          event_id: 'root-transaction',
          op: 'pageload',
          description: 'root transaction',
          start_timestamp: start,
          end_timestamp: start + 2,
          is_transaction: true,
          additional_attributes: {
            'tags[performance.timeOrigin,number]': start,
          },
          children: [
            makeEAPSpan({
              event_id: 'lcp-span',
              op: 'ui.webvital.lcp',
              description: vitalSpanDescription,
              start_timestamp: start + 0.5,
              end_timestamp: start + 0.6,
              measurements: {'measurements.lcp': 500},
            }),
          ],
        }),
        makeEAPSpan({
          event_id: 'second-transaction',
          op: 'http.server',
          description: 'second transaction',
          start_timestamp: start,
          end_timestamp: start + 1,
          is_transaction: true,
          children: Array.from({length: 100}, (_, index) =>
            makeEAPSpan({
              event_id: `second-transaction-span-${index}`,
              start_timestamp: start,
              end_timestamp: start + 0.1,
            })
          ),
        }),
        makeEAPSpan({
          event_id: 'third-transaction',
          op: 'http.server',
          description: 'third transaction',
          start_timestamp: start,
          end_timestamp: start + 1,
          is_transaction: true,
        }),
      ]),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-meta/trace-id/',
      body: {
        errorsCount: 0,
        logsCount: 0,
        metricsCount: 0,
        performanceIssuesCount: 0,
        spansCount: 104,
        spansCountMap: {},
        transactionChildCountMap: [],
      },
    });
    for (const itemId of ['root-transaction', 'lcp-span']) {
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project_slug/trace-items/${itemId}/`,
        body: {
          itemId,
          links: null,
          meta: {},
          timestamp: new Date(start * 1e3).toISOString(),
          attributes: [],
        },
      });
    }
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/logs/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
    mockTraceRootFacets();
    mockEventsResponse();

    render(<TraceView />, {initialRouterConfig, organization});

    const rootTransaction = await screen.findByText('root transaction');
    expect(screen.queryByText(vitalSpanDescription)).not.toBeInTheDocument();

    await userEvent.click(rootTransaction);
    await userEvent.click(await screen.findByRole('button', {name: 'Close Drawer'}));
    await waitFor(() => {
      expect(screen.queryByTestId('trace-drawer-title')).not.toBeInTheDocument();
    });

    const vitalPill = (await screen.findAllByText('LCP')).find(element =>
      element.classList.contains('TraceIndicatorLabel')
    );
    expect(vitalPill).toBeDefined();

    await userEvent.click(vitalPill!);

    const vitalSpanRow = (await screen.findByText(vitalSpanDescription)).closest(
      VISIBLE_TRACE_ROW_SELECTOR
    );
    expect(vitalSpanRow).toHaveAttribute('tabindex', '0');
    expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
      'SpanID: lcp-span'
    );
  });

  describe('pageload', () => {
    it('scrolls to trace root', async () => {
      mockQueryString('?node=trace-root');
      const {virtualizedContainer} = await completeTestSetup();
      await waitFor(() => {
        const rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[0]).toHaveFocus();
      });
    });

    it('scrolls to transaction', async () => {
      mockQueryString('?node=txn-1');
      const {virtualizedContainer} = await completeTestSetup();
      await waitFor(() => {
        const rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[2]).toHaveFocus();
      });
    });

    it('scrolls to span that is a child of transaction', async () => {
      mockQueryString('?node=span-span0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await within(virtualizedContainer).findAllByText(/Autogrouped/i);

      // We need to await a tick because the row is not focused until the next tick
      const rows = getVirtualizedRows(virtualizedContainer);
      await waitFor(() => {
        expect(rows[3]).toHaveFocus();
      });
      expect(rows[3]!.textContent?.includes('http — request')).toBe(true);
    });

    it('scrolls to parent autogroup node', async () => {
      mockQueryString('?node=ag-redis0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await within(virtualizedContainer).findAllByText(/Autogrouped/i);

      // We need to await a tick because the row is not focused until the next tick
      const rows = getVirtualizedRows(virtualizedContainer);
      await waitFor(() => {
        expect(rows[4]).toHaveFocus();
      });
      expect(rows[4]!.textContent?.includes('Autogrouped')).toBe(true);
    });
    it('scrolls to child of parent autogroup node', async () => {
      // Passing an invalid targetId to the query string will still scroll to the child of the parent autogroup node
      // as path is prioritized over targetId/eventId
      mockQueryString('?node=span-redis0&node=txn-1&targetId=doesnotexist');

      const {virtualizedContainer} = await completeTestSetup();
      await within(virtualizedContainer).findAllByText(/Autogrouped/i);

      // We need to await a tick because the row is not focused until the next tick
      const rows = getVirtualizedRows(virtualizedContainer);
      await waitFor(() => {
        expect(rows[5]).toHaveFocus();
      });
      expect(rows[5]!.textContent?.includes('db — redis')).toBe(true);
    });

    it('scrolls to sibling autogroup node', async () => {
      mockQueryString('?node=ag-span0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await within(virtualizedContainer).findAllByText(/Autogrouped/i);

      // We need to await a tick because the row is not focused until the next tick
      const rows = getVirtualizedRows(virtualizedContainer);
      await waitFor(() => {
        expect(rows[5]).toHaveFocus();
      });
      expect(rows[5]!.textContent?.includes('5Autogrouped')).toBe(true);
    });

    it('scrolls to child of sibling autogroup node', async () => {
      // Passing an invalid targetId to the query string will still scroll to the child of the parent autogroup node
      // as path is prioritized over targetId/eventId
      mockQueryString('?node=span-http0&node=txn-1&targetId=doesnotexist');

      const {virtualizedContainer} = await completeTestSetup();
      await within(virtualizedContainer).findAllByText(/Autogrouped/i);

      // We need to await a tick because the row is not focused until the next tick
      const rows = getVirtualizedRows(virtualizedContainer);
      await waitFor(() => {
        expect(rows[6]).toHaveFocus();
      });
      expect(rows[6]!.textContent?.includes('http — request')).toBe(true);
    });

    it('scrolls to missing instrumentation node', async () => {
      mockTracePreferences({missing_instrumentation: true});
      mockQueryString('?node=ms-queueprocess0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await within(virtualizedContainer).findAllByText(/Autogrouped/i);

      // We need to await a tick because the row is not focused until the next ticks
      const rows = getVirtualizedRows(virtualizedContainer);
      await waitFor(() => {
        expect(rows[7]).toHaveFocus();
      });
      expect(rows[7]!.textContent?.includes('No Instrumentation')).toBe(true);
    });

    it('scrolls to trace error node', async () => {
      mockQueryString('?node=error-error0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();
      await within(virtualizedContainer).findAllByText(/Autogrouped/i);

      // We need to await a tick because the row is not focused until the next ticks
      const rows = getVirtualizedRows(virtualizedContainer);
      await waitFor(() => {
        expect(rows[11]).toHaveFocus();
      });
      expect(rows[11]!.textContent?.includes('error-title')).toBe(true);
    });

    it('scrolls to event id query param', async () => {
      mockQueryString('?eventId=1');
      const {virtualizedContainer} = await completeTestSetup();

      await waitFor(() => {
        const rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[2]).toHaveFocus();
      });
    });

    it('supports expanded node path', async () => {
      mockQueryString('?node=span-span0&node=txn-1&span-0&node=txn-0');
      const {virtualizedContainer} = await completeTestSetup();
      await within(virtualizedContainer).findAllByText(/Autogrouped/i);

      const rows = getVirtualizedRows(virtualizedContainer);
      await waitFor(() => {
        expect(rows[3]).toHaveFocus();
      });
      expect(rows[3]!.textContent?.includes('http — request')).toBe(true);
    });

    it.each([
      '?eventId=doesnotexist',
      '?node=txn-doesnotexist',
      // Invalid path
      '?node=span-does-notexist',
    ] as Array<`?${string}`>)('logs if path is not found: %s', async path => {
      mockQueryString(path);

      jest.spyOn(Sentry.logger, 'warn');
      await pageloadTestSetup();

      await waitFor(() => {
        expect(Sentry.logger.warn).toHaveBeenCalledWith(
          'Failed to scroll to node in trace tree'
        );
      });
    });

    it('does not autogroup if user preference is disabled', async () => {
      mockTracePreferences({autogroup: {parent: false, sibling: false}});
      mockQueryString('?node=span-span0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();

      await within(virtualizedContainer).findAllByText(/process/i);
      expect(screen.queryByText(/Autogrouped/i)).not.toBeInTheDocument();
    });

    it('does not inject missing instrumentation if user preference is disabled', async () => {
      mockTracePreferences({missing_instrumentation: false});
      mockQueryString('?node=span-span0&node=txn-1');

      const {virtualizedContainer} = await completeTestSetup();

      await within(virtualizedContainer).findAllByText(/process/i);
      expect(screen.queryByText(/Missing instrumentation/i)).not.toBeInTheDocument();
    });

    describe('preferences', () => {
      it('toggles autogrouping', async () => {
        mockTracePreferences({autogroup: {parent: true, sibling: true}});
        mockQueryString('?node=span-span0&node=txn-1');

        const {virtualizedContainer} = await completeTestSetup();
        await within(virtualizedContainer).findAllByText(/Autogrouped/i);

        const preferencesDropdownTrigger = screen.getByLabelText('Trace Preferences');
        await userEvent.click(preferencesDropdownTrigger);

        expect(await screen.findByText('Autogrouping')).toBeInTheDocument();

        // Toggle autogrouping off
        const autogroupingOption = await screen.findByText('Autogrouping');
        await userEvent.click(autogroupingOption);

        await waitFor(() => {
          expect(screen.queryByText('Autogrouped')).not.toBeInTheDocument();
        });

        // Toggle autogrouping back on
        await userEvent.click(await screen.findByText('Autogrouping'));
        expect(await screen.findAllByText('Autogrouped')).toHaveLength(2);
      });

      it('toggles missing instrumentation', async () => {
        mockTracePreferences({missing_instrumentation: true});
        mockQueryString('?node=span-span0&node=txn-1');

        const {virtualizedContainer} = await completeTestSetup();
        await within(virtualizedContainer).findAllByText(/No Instrumentation/i);

        const preferencesDropdownTrigger = screen.getByLabelText('Trace Preferences');
        await userEvent.click(preferencesDropdownTrigger);

        expect(await screen.findAllByText('No Instrumentation')).toHaveLength(2);

        // Toggle autogrouping off
        const autogroupingOption = await screen.findByTestId('no-instrumentation');
        await userEvent.click(autogroupingOption);

        await waitFor(async () => {
          expect(await screen.findAllByText('No Instrumentation')).toHaveLength(1);
        });

        // Toggle autogrouping back on
        await userEvent.click(autogroupingOption);
        await waitFor(async () => {
          expect(await screen.findAllByText('No Instrumentation')).toHaveLength(2);
        });
      });

      it('redraws the trace when compressed timeline changes', async () => {
        mockTracePreferences({compressed_timeline: true});
        mockQueryString('?node=span-span0&node=txn-1');
        const organization = OrganizationFixture({
          features: ['trace-waterfall-time-compression'],
        });

        const drawSpy = jest.spyOn(VirtualizedViewManager.prototype, 'draw');
        const successMessageSpy = jest.spyOn(indicators, 'addSuccessMessage');

        try {
          await completeTestSetup({organization});

          const preferencesDropdownTrigger = screen.getByLabelText('Trace Preferences');
          await userEvent.click(preferencesDropdownTrigger);

          expect(await screen.findByText('Compressed Timeline')).toBeInTheDocument();

          drawSpy.mockClear();
          const compressedTimelineOption = await screen.findByText('Compressed Timeline');
          await userEvent.click(compressedTimelineOption);

          expect(successMessageSpy).toHaveBeenCalledWith('Compressed timeline disabled');
          await waitFor(() => {
            expect(drawSpy).toHaveBeenCalled();
          });
        } finally {
          drawSpy.mockRestore();
          successMessageSpy.mockRestore();
        }
      });

      it('hides and disables compressed timeline without the feature flag', async () => {
        mockTracePreferences({compressed_timeline: true});
        mockQueryString('?node=span-span0&node=txn-1');

        const compressionSpy = jest.spyOn(TraceTimeCompression, 'FromVisibleItems');

        try {
          await completeTestSetup();

          const preferencesDropdownTrigger = screen.getByLabelText('Trace Preferences');
          await userEvent.click(preferencesDropdownTrigger);

          expect(screen.queryByText('Compressed Timeline')).not.toBeInTheDocument();
          expect(compressionSpy.mock.calls.at(-1)?.[0]?.enabled).toBe(false);
        } finally {
          compressionSpy.mockRestore();
        }
      });

      it('renders compressed timeline gap markers as non-interactive overlays', async () => {
        mockTracePreferences({compressed_timeline: true});
        const organization = OrganizationFixture({
          features: ['trace-waterfall-time-compression'],
        });
        const compressionSpy = jest
          .spyOn(TraceTimeCompression, 'FromVisibleItems')
          .mockImplementation(options => {
            const [traceStart, traceDuration] = options.traceSpace;
            return {
              start: traceStart,
              duration: traceDuration,
              compressedDuration: traceDuration,
              enabled: true,
              gaps: [
                {
                  start: traceStart + 0.5,
                  end: traceStart + 1,
                  duration: 0.5,
                  retainedDuration: 0.1,
                  compressedStart: 0.5,
                  compressedEnd: 0.6,
                },
              ],
              toCompressedOffset: (timestamp: number) => timestamp - traceStart,
              toRealTimestamp: (offset: number) => traceStart + offset,
            };
          });

        try {
          const {virtualizedScrollContainer} = await completeTestSetup({organization});

          const marker = await waitFor(() => {
            const nextMarker = document.querySelector<HTMLElement>(
              '.TraceCollapsedGapMarker'
            );
            if (!nextMarker) {
              throw new Error('Expected compressed timeline gap marker to render');
            }
            return nextMarker;
          });

          expect(marker).toHaveStyle({pointerEvents: 'none'});

          const pill = marker.querySelector<HTMLElement>('.TraceCollapsedGapMarkerPill');
          if (!pill) {
            throw new Error('Expected compressed timeline gap marker pill to render');
          }
          expect(pill).toHaveStyle({pointerEvents: 'auto'});
          fireEvent.wheel(pill, {deltaY: 24});
          expect(virtualizedScrollContainer.scrollTop).toBe(24);

          await userEvent.hover(pill);
          expect(
            await screen.findByText(/Skipped .* inactive period/)
          ).toBeInTheDocument();
        } finally {
          compressionSpy.mockRestore();
        }
      });

      it('recomputes compressed timeline when expanding or collapsing rows changes visible nodes', async () => {
        mockTracePreferences({compressed_timeline: true});
        mockQueryString('?node=span-span0&node=txn-1');
        const organization = OrganizationFixture({
          features: ['trace-waterfall-time-compression'],
        });

        const compressionSpy = jest.spyOn(TraceTimeCompression, 'FromVisibleItems');

        try {
          const {virtualizedContainer} = await completeTestSetup({organization});
          await within(virtualizedContainer).findAllByText(/Autogrouped/i);

          const initialNodeCount =
            compressionSpy.mock.calls.at(-1)?.[0]?.nodes.length ?? 0;
          expect(initialNodeCount).toBeGreaterThan(0);

          compressionSpy.mockClear();

          const rows = getVirtualizedRows(virtualizedContainer);
          const spanRow = rows.find(row => row.textContent?.includes('http — request'));
          const collapseButton =
            spanRow?.querySelector<HTMLButtonElement>('.TraceChildrenCount');
          expect(collapseButton).toBeInTheDocument();

          fireEvent.click(collapseButton!);

          await waitFor(() => {
            expect(compressionSpy).toHaveBeenCalled();
          });

          expect(compressionSpy.mock.calls.at(-1)?.[0]?.nodes.length).toBeLessThan(
            initialNodeCount
          );
        } finally {
          compressionSpy.mockRestore();
        }
      });
    });
  });

  describe('keyboard navigation', () => {
    it('arrow down', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);

      await userEvent.click(rows[0]!);
      await waitFor(() => expect(rows[0]).toHaveFocus());

      await userEvent.keyboard('{arrowdown}');
      await waitFor(() => expect(rows[1]).toHaveFocus());
    });

    it('arrow up', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);

      await userEvent.click(rows[1]!);
      await waitFor(() => expect(rows[1]).toHaveFocus());

      await userEvent.keyboard('{arrowup}');
      await waitFor(() => expect(rows[0]).toHaveFocus());
    });

    it('arrow right expands row and fetches data', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);

      mockSpansResponse(
        '0',
        {},
        {
          entries: [
            {
              type: EntryType.SPANS,
              data: [makeSpan({span_id: '0', op: 'special-span'})],
            },
          ],
        }
      );
      await userEvent.click(rows[1]!);
      await waitFor(() => expect(rows[1]).toHaveFocus());

      await userEvent.keyboard('{arrowright}');
      await waitFor(() => {
        expect(screen.getByText('special-span')).toBeInTheDocument();
      });
    });

    it('arrow left collapses row', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);

      mockSpansResponse(
        '0',
        {},
        {
          entries: [
            {
              type: EntryType.SPANS,
              data: [makeSpan({span_id: '0', op: 'special-span'})],
            },
          ],
        }
      );
      await userEvent.click(rows[1]!);
      await waitFor(() => expect(rows[1]).toHaveFocus());

      await userEvent.keyboard('{arrowright}');

      expect(await screen.findByText('special-span')).toBeInTheDocument();
      await userEvent.keyboard('{arrowleft}');

      await waitFor(() => {
        expect(screen.queryByText('special-span')).not.toBeInTheDocument();
      });
    });

    it('arrow left does not collapse trace root row', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);

      await userEvent.click(rows[0]!);
      await waitFor(() => expect(rows[0]).toHaveFocus());

      await userEvent.keyboard('{arrowleft}');
      expect(await screen.findByText('transaction-name-1')).toBeInTheDocument();
    });

    it('arrow left on transaction row still renders transaction children', async () => {
      const {virtualizedContainer} = await nestedTransactionsTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);

      await userEvent.click(rows[1]!);
      await waitFor(() => expect(rows[1]).toHaveFocus());

      await userEvent.keyboard('{arrowleft}');
      expect(await screen.findByText('transaction-name-2')).toBeInTheDocument();
    });

    it('arrowup on first node jumps to end', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = getVirtualizedRows(virtualizedContainer);
      await userEvent.click(rows[0]!);

      await waitFor(() => expect(rows[0]).toHaveFocus());
      await userEvent.keyboard('{arrowup}');

      expect(
        await within(virtualizedContainer).findByText(/transaction-op-99/i)
      ).toBeInTheDocument();

      await waitFor(() => {
        rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[rows.length - 1]).toHaveFocus();
      });
    });

    it('arrowdown on last node jumps to start', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = getVirtualizedRows(virtualizedContainer);
      await userEvent.click(rows[0]!);
      await waitFor(() => expect(rows[0]).toHaveFocus());

      await userEvent.keyboard('{arrowup}');
      await waitFor(() => {
        rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[rows.length - 1]).toHaveFocus();
      });
      expect(
        await within(virtualizedContainer).findByText(/transaction-op-99/i)
      ).toBeInTheDocument();

      await userEvent.keyboard('{arrowdown}');
      await waitFor(() => {
        rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[0]).toHaveFocus();
      });
      expect(
        await within(virtualizedContainer).findByText(/transaction-op-0/i)
      ).toBeInTheDocument();
    });

    it('tab scrolls to next node', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = getVirtualizedRows(virtualizedContainer);
      await userEvent.click(rows[0]!);

      await waitFor(() => expect(rows[0]).toHaveFocus());
      await userEvent.keyboard('{tab}');

      await waitFor(() => {
        rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[1]).toHaveFocus();
      });
    });

    it('shift+tab scrolls to previous node', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = getVirtualizedRows(virtualizedContainer);
      await userEvent.click(rows[1]!);

      await waitFor(() => {
        rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[1]).toHaveFocus();
      });
      await userEvent.keyboard('{Shift>}{tab}{/Shift}');

      await waitFor(() => {
        rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[0]).toHaveFocus();
      });
    });

    it('arrowdown+shift scrolls to the end of the list', async () => {
      const {container, virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      await userEvent.click(rows[0]!);

      await waitFor(() => {
        rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[0]).toHaveFocus();
      });
      await userEvent.keyboard('{Shift>}{arrowdown}{/Shift}');

      expect(
        await within(virtualizedContainer).findByText(/transaction-op-99/i)
      ).toBeInTheDocument();
      await waitFor(() => {
        rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[rows.length - 1]).toHaveFocus();
      });
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('arrowup+shift scrolls to the start of the list', async () => {
      const {virtualizedContainer} = await keyboardNavigationTestSetup();

      let rows = getVirtualizedRows(virtualizedContainer);

      await userEvent.click(rows[1]!);
      await waitFor(() => {
        rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[1]).toHaveFocus();
      });

      await userEvent.keyboard('{Shift>}{arrowdown}{/Shift}');
      expect(
        await within(virtualizedContainer).findByText(/transaction-op-99/i)
      ).toBeInTheDocument();

      await waitFor(() => {
        rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[rows.length - 1]).toHaveFocus();
      });

      await userEvent.keyboard('{Shift>}{arrowup}{/Shift}');

      expect(
        await within(virtualizedContainer).findByText(/transaction-op-0/i)
      ).toBeInTheDocument();

      await waitFor(() => {
        rows = getVirtualizedRows(virtualizedContainer);
        expect(rows[0]).toHaveFocus();
      });
    });
  });

  describe('search', () => {
    it('triggers search on load but does not steal focus from node param', async () => {
      mockQueryString('?search=transaction-op-99&node=txn-0');

      const {virtualizedContainer} = await pageloadTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      expect(searchInput).toHaveValue('transaction-op-99');

      await waitFor(() => {
        expect(screen.queryByTestId('trace-search-result-iterator')).toHaveTextContent(
          '-/1'
        );
      });

      const rows = getVirtualizedRows(virtualizedContainer);
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

      await waitFor(() => {
        const rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[6]).toHaveFocus();
      });
    });

    it('searches in transaction', async () => {
      const {container} = await searchTestSetup();

      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);
      await userEvent.paste('transaction-op');

      await waitFor(() => expect(searchInput).toHaveValue('transaction-op'));
      await searchToResolve();

      await assertHighlightedRowAtIndex(container, 1);
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('supports roving with arrowup and arrowdown', async () => {
      const {container} = await searchTestSetup();

      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.type(searchInput, 'transaction-op');
      expect(searchInput).toHaveValue('transaction-op');
      await searchToResolve();

      for (const action of [
        // starting at the top, jump bottom with shift+arrowdown
        ['{Shift>}{arrowdown}{/Shift}', 11],
        // move to row above with arrowup
        ['{arrowup}', 10],
        // and jump back to top with shift+arrowup
        ['{Shift>}{arrowup}{/Shift}', 1],
        // and jump to next row with arrowdown
        ['{arrowdown}', 2],
      ] as const) {
        await userEvent.keyboard(action[0]);

        await assertHighlightedRowAtIndex(container, action[1]);
      }
    });

    it('search roving updates the element in the drawer', async () => {
      await searchTestSetup();

      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);
      await userEvent.paste('transaction-op');
      await waitFor(() => expect(searchInput).toHaveValue('transaction-op'));

      // Wait for the search results to resolve
      await searchToResolve();

      expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
        'TransactionID: 0'
      );

      // assert that focus on search input is never lost
      expect(searchInput).toHaveFocus();
      await userEvent.keyboard('{arrowdown}');

      await waitFor(() => {
        expect(screen.getByTestId('trace-drawer-title')).toHaveTextContent(
          'TransactionID: 1'
        );
      });
    });

    it('highlighted node narrows down on the first result', async () => {
      const {container} = await searchTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');

      await userEvent.click(searchInput);
      await userEvent.paste('transaction-op-1');
      await waitFor(() => expect(searchInput).toHaveValue('transaction-op-1'));
      await searchToResolve();

      await assertHighlightedRowAtIndex(container, 2);

      await userEvent.clear(searchInput);
      await waitFor(() => expect(searchInput).toHaveValue(''));
      await userEvent.click(searchInput);
      await userEvent.paste('transaction-op-5');
      await waitFor(() => expect(searchInput).toHaveValue('transaction-op-5'));
      await searchToResolve();

      await assertHighlightedRowAtIndex(container, 6);
    });

    // TODO Abdullah Khan: This is flaky, we need to fix it
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('highlighted is persisted on node while it is part of the search results', async () => {
      const {container} = await searchTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.type(searchInput, 'trans');
      await waitFor(() => expect(searchInput).toHaveValue('trans'));
      // Wait for the search results to resolve
      await searchToResolve();

      await userEvent.keyboard('{arrowdown}');
      await searchToResolve();

      await assertHighlightedRowAtIndex(container, 2);

      await userEvent.type(searchInput, 'act');
      await waitFor(() => expect(searchInput).toHaveValue('transact'));
      await searchToResolve();

      // Highlighting is persisted on the row
      await assertHighlightedRowAtIndex(container, 2);

      await userEvent.clear(searchInput);
      await userEvent.click(searchInput);
      await userEvent.paste('this wont match anything');
      await waitFor(() => expect(searchInput).toHaveValue('this wont match anything'));
      await searchToResolve();

      // When there is no match, the highlighting is removed
      await waitFor(() => {
        expect(container.querySelectorAll('.TraceRow.Highlight')).toHaveLength(0);
      });
    });

    it('auto highlights the first result when search begins', async () => {
      const {container} = await searchTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');

      // Nothing is highlighted
      expect(container.querySelectorAll('.TraceRow.Highlight')).toHaveLength(0);
      await userEvent.type(searchInput, 't');
      await waitFor(() => expect(searchInput).toHaveValue('t'));

      // Wait for the search results to resolve
      await searchToResolve();

      await assertHighlightedRowAtIndex(container, 1);
    });

    // TODO Abdullah Khan: This is flaky, and when it flakes it takes over 90s to run
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('clicking a row that is also a search result updates the result index', async () => {
      const {container, virtualizedContainer} = await searchTestSetup();

      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.type(searchInput, 'transaction-op-1');
      await waitFor(() => expect(searchInput).toHaveValue('transaction-op-1'));

      await searchToResolve();

      await assertHighlightedRowAtIndex(container, 2);
      const rows = getVirtualizedRows(virtualizedContainer);
      // By default, we highlight the first result
      expect(await screen.findByTestId('trace-search-result-iterator')).toHaveTextContent(
        '1/2'
      );

      // Click on a random row in the list that is not a search result
      await userEvent.click(rows[5]!);
      await waitFor(() => {
        expect(screen.queryByTestId('trace-search-result-iterator')).toHaveTextContent(
          '-/2'
        );
      });

      // Click on a the row in the list that is a search result
      await userEvent.click(rows[2]!);
      await waitFor(() => {
        expect(screen.queryByTestId('trace-search-result-iterator')).toHaveTextContent(
          '1/2'
        );
      });
    });

    // Really flakey, blocking deploys
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('during search, expanding a row retriggers search', async () => {
      mockPerformanceSubscriptionDetailsResponse();
      mockProjectDetailsResponse();

      mockTraceRootFacets();
      mockTraceRootEvent('0');
      mockTraceEventDetails();

      mockEventsResponse();

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
          span_count: 200,
          span_count_map: {},
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
                makeSpan({
                  span_id: '0',
                  description: 'span-description',
                  op: 'op-0',
                }),
              ],
            },
          ],
        }
      );

      const {container} = render(<TraceView />, {
        initialRouterConfig,
      });

      // Awaits for the placeholder rendering rows to be removed
      await within(container).findByText(/transaction-op-0/i);

      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.type(searchInput, 'op-0');
      await waitFor(() => expect(searchInput).toHaveValue('op-0'));

      await searchToResolve();

      await waitFor(() => {
        expect(screen.queryByTestId('trace-search-result-iterator')).toHaveTextContent(
          '1/1'
        );
      });

      const open = await screen.findAllByRole('button', {name: '+'});
      await userEvent.click(open[0]!);

      await waitFor(() => {
        expect(screen.queryByTestId('trace-search-result-iterator')).toHaveTextContent(
          '1/1'
        );
      });

      expect(await screen.findByText('span-description')).toBeInTheDocument();
      expect(spansRequest).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.queryByTestId('trace-search-result-iterator')).toHaveTextContent(
          '1/2'
        );
      });
    });

    it('during search, highlighting is persisted on the row', async () => {
      const {container} = await searchTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      await userEvent.click(searchInput);
      await userEvent.paste('transaction-op');
      await waitFor(() => expect(searchInput).toHaveValue('transaction-op'));
      await searchToResolve();

      await assertHighlightedRowAtIndex(container, 1);

      // User moves down the list using keyboard navigation
      for (let i = 1; i < 6; i++) {
        await userEvent.keyboard('{arrowDown}');
        await assertHighlightedRowAtIndex(container, 1 + i);
      }

      // User clicks on an entry in the list, then proceeds to search
      await waitFor(() => {
        expect(screen.getByTestId('trace-search-result-iterator')).toHaveTextContent(
          '6/11'
        );
      });
      // And then continues the query - the highlighting is preserved as long as the
      // row is part of the search results
      await assertHighlightedRowAtIndex(container, 6);

      await userEvent.click(searchInput);
      await userEvent.type(searchInput, '-');
      await waitFor(() => expect(searchInput).toHaveValue('transaction-op-'));
      await userEvent.type(searchInput, '5');
      await waitFor(() => expect(searchInput).toHaveValue('transaction-op-5'));

      await waitFor(() => {
        expect(screen.getByTestId('trace-search-result-iterator')).toHaveTextContent(
          '1/1'
        );
      });
      await assertHighlightedRowAtIndex(container, 6);

      // Keep the previous results until the new search completes. Clearing the
      // query also resets the results and can make the idle icon look finished.
      await userEvent.type(searchInput, '-none');
      expect(searchInput).toHaveValue('transaction-op-5-none');
      await waitFor(() => {
        expect(screen.getByTestId('trace-search-result-iterator')).toHaveTextContent(
          'no results'
        );
      });
      await waitFor(() => {
        // eslint-disable-next-line testing-library/no-container
        expect(container.querySelectorAll('.TraceRow.Highlight')).toHaveLength(0);
      });
    }, 20_000);
  });

  describe('tabbing', () => {
    it('does not fetch trace-wide logs when opening a waterfall drawer', async () => {
      const organization = OrganizationFixture({features: ['ourlogs-enabled']});
      const traceLogsRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/trace-logs/`,
        body: {data: []},
      });
      const {virtualizedContainer} = await completeTestSetup({organization});
      const rows = getVirtualizedRows(virtualizedContainer);

      expect(traceLogsRequest).not.toHaveBeenCalled();
      await userEvent.click(rows[5]!);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);
      });
      expect(traceLogsRequest).not.toHaveBeenCalled();
    });

    it('clicking on a node spawns a new tab when none is selected', async () => {
      const {virtualizedContainer} = await simpleTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(0);
      await userEvent.click(rows[5]!);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);
      });
    });

    it('clicking on a node replaces the previously selected tab', async () => {
      const {virtualizedContainer} = await simpleTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(0);

      await userEvent.click(rows[5]!);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);
      });
      expect(
        screen
          .getAllByTestId(DRAWER_TABS_TEST_ID)[0]!
          .textContent?.includes('transaction-op-4')
      ).toBeTruthy();

      await userEvent.click(rows[7]!);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);
      });
      await waitFor(() => {
        expect(
          screen
            .getAllByTestId(DRAWER_TABS_TEST_ID)[0]!
            .textContent?.includes('transaction-op-6')
        ).toBeTruthy();
      });
    });

    it('pinning a tab and clicking on a new node spawns a new tab', async () => {
      const {virtualizedContainer} = await simpleTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(0);

      await userEvent.click(rows[5]!);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);
      });

      await userEvent.click(await screen.findByTestId(DRAWER_TABS_PIN_BUTTON_TEST_ID));
      await userEvent.click(rows[7]!);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
      });
      expect(
        screen
          .getAllByTestId(DRAWER_TABS_TEST_ID)[0]!
          .textContent?.includes('transaction-op-4')
      ).toBeTruthy();
      expect(
        screen
          .getAllByTestId(DRAWER_TABS_TEST_ID)[1]!
          .textContent?.includes('transaction-op-6')
      ).toBeTruthy();
    });

    it('unpinning a tab removes it', async () => {
      const {virtualizedContainer} = await simpleTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(0);

      await userEvent.click(rows[5]!);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);
      });

      await userEvent.click(await screen.findByTestId(DRAWER_TABS_PIN_BUTTON_TEST_ID));
      await userEvent.click(rows[7]!);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
      });

      const tabButtons = screen.queryAllByTestId(DRAWER_TABS_PIN_BUTTON_TEST_ID);
      expect(tabButtons).toHaveLength(2);

      await userEvent.click(tabButtons[0]!);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
      });
    });

    // TODO Abdullah Khan: This is flaky, and when it flakes it takes over 90s to run
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('clicking a node that is already open in a tab switches to that tab and persists the previous node', async () => {
      const {virtualizedContainer} = await simpleTestSetup();
      const rows = getVirtualizedRows(virtualizedContainer);
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(0);

      await userEvent.click(rows[5]!);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);
      });

      await userEvent.click(await screen.findByTestId(DRAWER_TABS_PIN_BUTTON_TEST_ID));
      await userEvent.click(rows[7]!);

      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
      });
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)[1]).toHaveAttribute(
        'aria-selected',
        'true'
      );

      await userEvent.click(rows[5]!);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)[1]).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
      expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
    });
  });
});
