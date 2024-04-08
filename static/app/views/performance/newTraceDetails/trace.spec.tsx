import {act} from 'react-dom/test-utils';
import * as Sentry from '@sentry/react';
import MockDate from 'mockdate';
import {DetailedEventsFixture} from 'sentry-fixture/events';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  findByText,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {EntryType, type Event, type EventTransaction} from 'sentry/types';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {TraceView} from 'sentry/views/performance/newTraceDetails/index';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {RouteContext} from 'sentry/views/routeContext';

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
    throw new Error('not implemented');
  }

  observe(element: HTMLElement) {
    // Executes in sync so we dont have to
    this.callback(
      [
        {
          target: element,
          // @ts-expect-error partial mock
          contentRect: {width: 1000, height: 24 * 10 - 1},
        },
      ],
      this
    );
  }
  disconnect() {}
}

function TraceViewWithProviders({traceSlug}: {traceSlug: string}) {
  const {router} = initializeOrg({
    project: ProjectFixture(),
  });
  return (
    <RouteContext.Provider
      value={{
        router,
        location: router.location,
        params: {...router.params, traceSlug},
        routes: router.routes,
      }}
    >
      <TraceView />
    </RouteContext.Provider>
  );
}

type Arguments<F extends Function> = F extends (...args: infer A) => any ? A : never;
type ResponseType = Arguments<typeof MockApiClient.addMockResponse>[0];

function mockTraceResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-trace/trace-id/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {}),
  });
}

function mockTraceMetaResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-trace-meta/trace-id/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {}),
  });
}

function mockTraceTagsResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-facets/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {}),
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
    ...(resp ?? {}),
  });
}

function mockTraceRootEvent(id: string, resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/project_slug:${id}/`,
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {}),
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
    ...(resp ?? {}),
  });
}

function mockSpansResponse(
  id: string,
  resp?: Partial<ResponseType>,
  body: Partial<EventTransaction> = {}
) {
  return MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/project_slug:${id}/?averageColumn=span.self_time`,
    method: 'GET',
    asyncDelay: 1,
    body,
    ...(resp ?? {}),
  });
}

let sid = -1;
let tid = -1;
const span_id = () => `${++sid}`;
const txn_id = () => `${++tid}`;

function makeTransaction(overrides: Partial<TraceFullDetailed> = {}): TraceFullDetailed {
  const t = txn_id();
  const s = span_id();
  return {
    children: [],
    event_id: t,
    parent_event_id: 'parent_event_id',
    parent_span_id: 'parent_span_id',
    start_timestamp: 0,
    timestamp: 1,
    generation: 0,
    span_id: s,
    'transaction.duration': 1,
    transaction: 'transaction-name' + t,
    'transaction.op': 'transaction-op-' + t,
    'transaction.status': '',
    project_id: 0,
    project_slug: 'project_slug',
    errors: [],
    performance_issues: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}, spans: RawSpanType[] = []): Event {
  return {
    entries: [{type: EntryType.SPANS, data: spans}],
    ...overrides,
  } as Event;
}

function makeSpan(overrides: Partial<RawSpanType> = {}): TraceTree.Span {
  return {
    span_id: '',
    op: '',
    description: '',
    start_timestamp: 0,
    timestamp: 10,
    data: {},
    trace_id: '',
    childTransaction: undefined,
    event: makeEvent() as EventTransaction,
    ...overrides,
  };
}

async function keyboardNavigationTestSetup() {
  const keyboard_navigation_transactions: TraceFullDetailed[] = [];
  for (let i = 0; i < 1e4; i++) {
    keyboard_navigation_transactions.push(
      makeTransaction({
        span_id: i + '',
        event_id: i + '',
        transaction: 'transaction-name' + i,
        'transaction.op': 'transaction-op-' + i,
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
  mockTraceMetaResponse();
  mockTraceRootFacets();
  mockTraceRootEvent('0', {body: DetailedEventsFixture()[0]});
  mockTraceEventDetails();

  const value = render(<TraceViewWithProviders traceSlug="trace-id" />);
  const virtualizedContainer = screen.queryByTestId('trace-virtualized-list');

  if (!virtualizedContainer) {
    throw new Error('Virtualized container not found');
  }

  // Awaits for the placeholder rendering rows to be removed
  expect(await findByText(value.container, /transaction-op-0/i)).toBeInTheDocument();
  return {...value, virtualizedContainer};
}

async function pageloadTestSetup() {
  const keyboard_navigation_transactions: TraceFullDetailed[] = [];
  for (let i = 0; i < 1e4; i++) {
    keyboard_navigation_transactions.push(
      makeTransaction({
        span_id: i + '',
        event_id: i + '',
        transaction: 'transaction-name' + i,
        'transaction.op': 'transaction-op-' + i,
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
  mockTraceMetaResponse();
  mockTraceRootFacets();
  mockTraceRootEvent('0', {body: DetailedEventsFixture()[0]});
  mockTraceEventDetails();

  const value = render(<TraceViewWithProviders traceSlug="trace-id" />);
  const virtualizedContainer = screen.queryByTestId('trace-virtualized-list');

  if (!virtualizedContainer) {
    throw new Error('Virtualized container not found');
  }

  // Awaits for the placeholder rendering rows to be removed
  expect((await screen.findAllByText(/transaction-op-/i)).length).toBeGreaterThan(0);
  return {...value, virtualizedContainer};
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
  mockTraceMetaResponse();
  mockTraceRootFacets();
  mockTraceRootEvent('0', {body: DetailedEventsFixture()[0]});
  mockTraceEventDetails();

  const value = render(<TraceViewWithProviders traceSlug="trace-id" />);
  const virtualizedContainer = screen.queryByTestId('trace-virtualized-list');

  if (!virtualizedContainer) {
    throw new Error('Virtualized container not found');
  }

  // Awaits for the placeholder rendering rows to be removed
  expect(await findByText(value.container, /transaction-op-0/i)).toBeInTheDocument();
  return {...value, virtualizedContainer};
}

const VISIBLE_TRACE_ROW_SELECTOR = '.TraceRow:not(.Hidden)';
const ACTIVE_SEARCH_HIGHLIGHT_ROW = '.TraceRow.SearchResult.Highlight:not(.Hidden)';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const searchToUpdate = (): Promise<void> => {
  return act(async () => {
    await wait(500);
  });
};

const scrollToEnd = (): Promise<void> => {
  return act(async () => {
    await wait(1000);
  });
};

function assertHighlightedRowAtIndex(virtualizedContainer: HTMLElement, index: number) {
  expect(virtualizedContainer.querySelectorAll('.TraceRow.Highlight')).toHaveLength(1);
  const highlighted_row = virtualizedContainer.querySelector(ACTIVE_SEARCH_HIGHLIGHT_ROW);
  const r = Array.from(virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR));
  expect(r.indexOf(highlighted_row!)).toBe(index);
}

describe('trace view', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = MockResizeObserver as any;

    Object.defineProperty(window, 'location', {
      value: {
        search: '',
      },
    });

    MockDate.reset();
  });
  afterEach(() => {
    // @ts-expect-error clear mock
    globalThis.ResizeObserver = undefined;
    // @ts-expect-error override it
    window.location = new URL('http://localhost/');
  });

  it('renders loading state', async () => {
    mockTraceResponse();
    mockTraceMetaResponse();
    mockTraceTagsResponse();

    render(<TraceViewWithProviders traceSlug="trace-id" />);
    expect(await screen.findByText(/assembling the trace/i)).toBeInTheDocument();
  });

  it('renders error state', async () => {
    mockTraceResponse({statusCode: 404});
    mockTraceMetaResponse({statusCode: 404});
    mockTraceTagsResponse({statusCode: 404});

    render(<TraceViewWithProviders traceSlug="trace-id" />);
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
    mockTraceTagsResponse({});

    render(<TraceViewWithProviders traceSlug="trace-id" />);
    expect(
      await screen.findByText(/trace does not contain any data/i)
    ).toBeInTheDocument();
  });

  describe('virtualized view', () => {
    it('renders transactions', async () => {
      const transactions: TraceFullDetailed[] = [];
      for (let i = 0; i < 1e4; i++) {
        transactions.push(makeTransaction());
      }

      mockTraceResponse({
        body: {
          transactions: transactions,
          orphan_errors: [],
        },
      });
      mockTraceMetaResponse();
      mockTraceTagsResponse();

      const {container} = render(<TraceViewWithProviders traceSlug="trace-id" />);

      await waitFor(() => {
        // 15 rows out of 10,000 are rendered, 10 fit in the view, 5 are part of the overscroll behavior
        expect(container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR)).toHaveLength(14);
      });
    });
  });

  describe('pageload', () => {
    it('highlights row at load and sets it as focused', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?node=txn-5',
        },
      });
      const {virtualizedContainer} = await pageloadTestSetup();

      expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
        'transaction-op-5'
      );
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(rows[6]).toHaveFocus();
    });
    it('scrolls at transaction span', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?node=span-5&node=txn-5',
        },
      });

      mockSpansResponse(
        '5',
        {},
        {
          entries: [
            {
              type: EntryType.SPANS,
              data: [makeSpan({span_id: '5', op: 'special-span'})],
            },
          ],
        }
      );

      const {virtualizedContainer} = await pageloadTestSetup();

      expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
        'special-span'
      );
      const rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(rows[7]).toHaveFocus();
    });
    it('scrolls far down the list of transactions', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?node=txn-500',
        },
      });

      await pageloadTestSetup();
      expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
        'transaction-op-500'
      );

      await act(async () => {
        await wait(1000);
      });

      await waitFor(() => {
        expect(document.activeElement).toHaveClass('TraceRow');
        expect(
          document.activeElement?.textContent?.includes('transaction-op-500')
        ).toBeTruthy();
      });
    });
    it('scrolls to event id query param and fetches its spans', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?eventId=500',
        },
      });

      const spanRequest = mockSpansResponse(
        '500',
        {},
        {
          entries: [
            {
              type: EntryType.SPANS,
              data: [makeSpan({span_id: '1', op: 'special-span'})],
            },
          ],
        }
      );

      await pageloadTestSetup();
      expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
        'transaction-op-500'
      );

      await waitFor(() => {
        expect(document.activeElement).toHaveClass('TraceRow');
        expect(
          document.activeElement?.textContent?.includes('transaction-op-500')
        ).toBeTruthy();
      });

      expect(spanRequest).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('special-span')).toBeInTheDocument();
    });
    it('logs if path is not found', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?eventId=bad_value',
        },
      });
      const sentrySpy = jest.spyOn(Sentry, 'captureMessage');
      await pageloadTestSetup();
      await waitFor(() => {
        expect(sentrySpy).toHaveBeenCalledWith(
          'Failed to find and scroll to node in tree'
        );
      });
    });

    it('triggers search on load', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?search=transaction-op-5',
        },
      });
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
      Object.defineProperty(window, 'location', {
        value: {
          search: '?search=transaction-op&node=txn-5',
        },
      });
      const {container} = await pageloadTestSetup();
      const searchInput = await screen.findByPlaceholderText('Search in trace');
      expect(searchInput).toHaveValue('transaction-op');

      await waitFor(() => {
        expect(screen.getByTestId('trace-search-result-iterator')).toHaveTextContent(
          '6/10000'
        );
      });

      const rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
      expect(rows[6]).toHaveFocus();
    });

    it('if search on load does not match anything, it does not steal focus', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?search=dead&node=txn-5',
        },
      });
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
    it('arrow right expands row and fetches data', async () => {
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
      await userEvent.keyboard('{arrowleft}');
      expect(screen.queryByText('special-span')).not.toBeInTheDocument();
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
      await waitFor(() => expect(rows[2]).toHaveFocus());

      expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
        'special-span'
      );
    });

    it('arrowup on first node jumps to start', async () => {
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
      await userEvent.keyboard('{arrowup}');

      expect(
        await findByText(virtualizedContainer, /transaction-op-9999/i)
      ).toBeInTheDocument();
      await waitFor(() => {
        rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[rows.length - 1]).toHaveFocus();
      });

      await userEvent.keyboard('{arrowdown}');
      expect(
        await findByText(virtualizedContainer, /transaction-op-0/i)
      ).toBeInTheDocument();

      await waitFor(() => {
        rows = virtualizedContainer.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);
        expect(rows[0]).toHaveFocus();
      });
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
        // // and jump to next row with arrowdown
        ['{arrowdown}', 2],
      ] as const) {
        await userEvent.keyboard(action[0] as string);
        // assert that focus on search input is never lost
        expect(searchInput).toHaveFocus();

        await waitFor(() => {
          // Only a single row is highlighted, the rest are search results
          expect(container.querySelectorAll('.TraceRow.SearchResult')).toHaveLength(11);
          assertHighlightedRowAtIndex(container, action[1]);
        });
      }
    });
    // @TODO I am torn on this because left-right
    // should probably also move the input cursor...
    // it.todo("supports expanding with arrowright")
    // it.todo("supports collapsing with arrowleft")
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

      assertHighlightedRowAtIndex(container, 11);
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
      mockTraceMetaResponse();
      mockTraceRootFacets();
      mockTraceRootEvent('0', {body: DetailedEventsFixture()[0]});
      mockTraceEventDetails();

      mockTraceResponse({
        body: {
          transactions: [
            makeTransaction({
              span_id: '0',
              event_id: '0',
              transaction: 'transaction-name-0',
              'transaction.op': 'transaction-op-0',
            }),
          ],
          orphan_errors: [],
        },
      });

      mockSpansResponse(
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

      const value = render(<TraceViewWithProviders traceSlug="trace-id" />);

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
      await userEvent.click(await screen.findByRole('button', {name: '+'}));
      expect(await screen.findByText('span-description')).toBeInTheDocument();
      await searchToUpdate();

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
      const rows = container.querySelectorAll(VISIBLE_TRACE_ROW_SELECTOR);

      await searchToUpdate();

      // User moves down the list using keyboard navigation
      while (container.querySelector('.TraceRow.Highlight') !== rows[6]) {
        await userEvent.keyboard('{arrowDown}');
      }

      // User clicks on an entry in the list, then proceeds to search
      expect(await screen.findByTestId('trace-search-result-iterator')).toHaveTextContent(
        '6/11'
      );

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

  describe('tabs', () => {
    it.todo('clicking on a node spawns a new tab when none is selected');
    it.todo('pinning a tab and clicking on a new node spawns a new tab');
    it.todo(
      'clicking on a node that is already open in a tab, switches to that tab and does not spawn a new one'
    );
    it.todo('clicking show in view scrolls to the node');
    it.todo('clickin on parent transaction spawns a new tab');
  });
});
