import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import {EntryType} from 'sentry/types/event';

import SessionDetailView from './index';

jest.mock('sentry/components/pageFilters/usePageFilters');

const SESSION_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
/**
 * Height the virtualized rail believes it has. Tall enough that every fixture in
 * this file fits inside it, so a test asserting on rows is testing the rail
 * rather than the virtualizer's window.
 */
const RAIL_VIEWPORT = 2000;
/** Height every rail row reports, so offsets in these tests are predictable. */
const RAIL_ROW_HEIGHT = 46;
const TRACE = '1'.repeat(32);
const PROJECT = ProjectFixture();

/**
 * The route band's own query, which is a `spans` read like the trace rows are and
 * so has to be told apart from them. It is the only one narrowed *to* a set of
 * `span.op`s.
 *
 * The negated form is excluded deliberately: the services band narrows by
 * `!span.op:[…]`, which contains this substring, and without the guard that query
 * would be answered by the route band's mock.
 */
function isRouteQuery(options: Record<string, any>) {
  const query = String(options.query.query);
  return query.includes('span.op:[') && !query.includes('!span.op:[');
}

/**
 * The services band's query: the fourth read of the `spans` dataset, and the only
 * one that drops the `session.id` term — it joins on trace ids instead, which is
 * the whole point of it.
 */
function isServicesQuery(options: Record<string, any>) {
  return String(options.query.query).includes('trace:[');
}

/**
 * The web vitals query, which is the third read of the `spans` dataset and, like
 * the route band's, has to be told apart from the trace rows. It is the only one
 * asking for a performance score.
 */
function isVitalsQuery(options: Record<string, any>) {
  return options.query.field.some((field: string) =>
    field.startsWith('performance_score(')
  );
}

function mockDataset(dataset: string, kind: 'count' | 'rows', data: unknown[]) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
    body: {data, meta: {fields: {}}},
    match: [
      (_url: string, options: Record<string, any>) =>
        options.query.dataset === dataset &&
        !isRouteQuery(options) &&
        !isServicesQuery(options) &&
        !isVitalsQuery(options) &&
        !isHealthQuery(options) &&
        // The counts query asks for aggregates only; the rows query asks for the
        // bare `timestamp` field plus the per-dataset row fields.
        (kind === 'count'
          ? !options.query.field.includes('timestamp')
          : options.query.field.includes('timestamp')),
    ],
  });
}

/**
 * The `pageload`/`navigation` arrivals the route band is built from. Every test
 * gets an empty one by default, so the band is absent unless a test is about it —
 * its route labels are the same strings the rail's trace rows carry, and two of
 * each would make every `getByText` over them ambiguous.
 */
function mockRouteVisits(data: unknown[]) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
    body: {data, meta: {fields: {}}},
    match: [(_url: string, options: Record<string, any>) => isRouteQuery(options)],
  });
}

/**
 * The server segment spans the services band is built from. Every test gets an
 * empty one by default, so the band is absent unless a test is about it — a band
 * appearing under every session with a trace would add rows to assertions about
 * the lanes above it.
 */
function mockServices(data: unknown[]) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
    body: {data, meta: {fields: {}}},
    match: [(_url: string, options: Record<string, any>) => isServicesQuery(options)],
  });
}

/**
 * Mocks one page of a rows query, matched on the cursor so a paged dataset can
 * be given a different response per page. `nextCursor` becomes the `Link` header
 * the fetch follows to ask for the page after it.
 */
function mockRowsPage(
  dataset: string,
  {
    cursor,
    data,
    nextCursor,
  }: {data: unknown[]; cursor?: string; nextCursor?: string | undefined}
) {
  const next = nextCursor
    ? `<https://sentry.io/next>; rel="next"; results="true"; cursor="${nextCursor}"`
    : '<https://sentry.io/next>; rel="next"; results="false"; cursor="0:0:0"';

  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
    body: {data, meta: {fields: {}}},
    headers: {Link: next},
    match: [
      (_url: string, options: Record<string, any>) =>
        options.query.dataset === dataset &&
        !isRouteQuery(options) &&
        !isServicesQuery(options) &&
        !isVitalsQuery(options) &&
        !isHealthQuery(options) &&
        options.query.field.includes('timestamp') &&
        options.query.cursor === cursor,
    ],
  });
}

/**
 * The session's web vital aggregates. Every test gets an empty one by default:
 * most sessions carry no browser telemetry, and the pills are absent unless a
 * test is about them.
 */
/**
 * The session-health query, which is a second `errors` read and so has to be told
 * apart from the count pass. It is the only one narrowed to unhandled errors.
 */
function isHealthQuery(options: Record<string, any>) {
  return String(options.query.query).includes('error.unhandled:true');
}

/**
 * The unhandled-error count the Health pill's verdict comes from. Every test gets
 * zero by default, so a session reads as healthy or errored unless a test is
 * about a crash.
 */
function mockUnhandled(count: number) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
    body: {data: [{'count()': count}], meta: {fields: {}}},
    match: [(_url: string, options: Record<string, any>) => isHealthQuery(options)],
  });
}

function mockVitals(data: unknown[]) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
    body: {data, meta: {fields: {}}},
    match: [(_url: string, options: Record<string, any>) => isVitalsQuery(options)],
  });
}

/** One aggregate row, as the events endpoint returns scores: 0-1 ratios. */
function vitalsRow({
  total,
  lcp,
  cls,
}: {
  cls?: {count: number; score: number; value: number};
  lcp?: {count: number; score: number; value: number};
  total?: number;
}) {
  return {
    'performance_score(measurements.score.total)': total ?? 0,
    'performance_score(measurements.score.lcp)': lcp?.score ?? 0,
    'count_scores(measurements.score.lcp)': lcp?.count ?? 0,
    'avg(browser.web_vital.lcp.value)': lcp?.value ?? 0,
    'performance_score(measurements.score.cls)': cls?.score ?? 0,
    'count_scores(measurements.score.cls)': cls?.count ?? 0,
    'avg(browser.web_vital.cls.value)': cls?.value ?? 0,
    'performance_score(measurements.score.fcp)': 0,
    'count_scores(measurements.score.fcp)': 0,
    'avg(browser.web_vital.fcp.value)': 0,
    'performance_score(measurements.score.inp)': 0,
    'count_scores(measurements.score.inp)': 0,
    'avg(browser.web_vital.inp.value)': 0,
    'performance_score(measurements.score.ttfb)': 0,
    'count_scores(measurements.score.ttfb)': 0,
    'avg(browser.web_vital.ttfb.value)': 0,
  };
}

function mockEmptyDatasets(except: string[] = []) {
  for (const dataset of ['logs', 'spans', 'tracemetrics', 'errors']) {
    if (except.includes(dataset)) {
      continue;
    }
    mockDataset(dataset, 'count', []);
    mockDataset(dataset, 'rows', []);
  }
}

/** The rail's rows, one per telemetry item. */
function railItems() {
  return screen.getAllByRole('listitem');
}

describe('SessionDetailView', () => {
  const organization = OrganizationFixture();
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/org-slug/explore/usersessions/${SESSION_ID}/`,
    },
    route: '/organizations/:orgId/explore/usersessions/:sessionId/',
  };

  beforeEach(() => {
    // jsdom implements neither: the rail calls scrollIntoView to reveal a row
    // selected from somewhere other than the rail, and the scrubber captures the
    // pointer so a drag survives leaving the track.
    Element.prototype.scrollIntoView = jest.fn();
    Element.prototype.setPointerCapture = jest.fn();
    // The rail is virtualized, and jsdom reports every element as zero high. A
    // virtualizer whose viewport is zero high mounts no rows, and rows that
    // measure zero all collapse onto one offset, so both have to report a size.
    //
    // `offsetHeight` rather than `getBoundingClientRect`, which is what
    // `@tanstack/virtual-core` actually reads for both the scroll element and each
    // measured row. Everything else keeps jsdom's zero, so the scrubber's own
    // per-element `withGeometry` stubs stay in charge of its geometry.
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.dataset.testId === 'session-rail') {
          return RAIL_VIEWPORT;
        }
        return this.dataset.index === undefined ? 0 : RAIL_ROW_HEIGHT;
      },
    });
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([PROJECT]);
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
    // Mocks are matched most-recently-registered first, so a test about the band
    // overrides this by calling `mockRouteVisits` itself.
    mockRouteVisits([]);
    mockServices([]);
    mockVitals([]);
    mockUnhandled(0);
    // The feedback lane rides on `issuePlatform` rather than on a dataset of its
    // own, so `mockEmptyDatasets` does not cover it. Empty by default, like the
    // route band: a test that is about feedback registers its own after this.
    mockDataset('issuePlatform', 'count', []);
    mockDataset('issuePlatform', 'rows', []);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replays/',
      method: 'GET',
      body: {data: []},
    });
  });

  it('names the session from its telemetry, keeping the full id one click away', async () => {
    mockEmptyDatasets(['spans']);
    mockDataset('spans', 'count', [
      {
        'count()': 1,
        'any(user.email)': 'lukas@example.com',
        'any(browser.name)': 'Chrome',
        'any(os.name)': 'macOS',
        'any(release)': '1.2.3',
      },
    ]);
    mockDataset('spans', 'rows', []);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    expect(await screen.findByText('lukas@example.com')).toBeInTheDocument();
    expect(screen.getByText('Chrome · macOS')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();

    // The handle stands in for the id, in the badge and in the breadcrumb; the
    // id itself is only ever copied, never shown.
    expect(screen.getAllByText(SESSION_ID.slice(0, 8))).toHaveLength(2);
    expect(screen.queryByText(SESSION_ID)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Copy session ID'})).toBeInTheDocument();
  });

  it('falls back to a handle-only name when nothing identifies the session', async () => {
    mockEmptyDatasets(['logs']);
    mockDataset('logs', 'count', [{'count()': 1}]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'first log',
        timestamp: '2024-01-01T00:00:01+00:00',
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    // Logs has no any() aggregate, so there was nothing to name it with.
    expect(await screen.findByText('Anonymous')).toBeInTheDocument();
    expect(screen.getAllByText(SESSION_ID.slice(0, 8))).toHaveLength(2);
  });

  it('shows per-dataset counts and a merged rail, newest first', async () => {
    mockDataset('logs', 'count', [{'count()': 2}]);
    mockDataset('spans', 'count', [{'count_unique(trace)': 1}]);
    mockDataset('tracemetrics', 'count', [{'count(session.id)': 3}]);
    mockDataset('errors', 'count', [{'count()': 1}]);

    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'first log',
        severity: 'INFO',
        timestamp: '2024-01-01T00:00:01+00:00',
        trace: TRACE,
      },
    ]);
    mockDataset('spans', 'rows', [
      {
        id: 'abc123def4567890',
        transaction: '/checkout',
        'span.description': 'GET /api/thing',
        'span.op': 'navigation',
        'span.duration': 250,
        timestamp: '2024-01-01T00:00:03+00:00',
        trace: TRACE,
      },
    ]);
    mockDataset('tracemetrics', 'rows', [
      {
        id: 'metric1',
        'metric.name': 'checkout.latency',
        'metric.type': 'distribution',
        value: 42,
        timestamp: '2024-01-01T00:00:02+00:00',
        trace: TRACE,
      },
    ]);
    mockDataset('errors', 'rows', [
      {
        id: 'deadbeefdeadbeefdeadbeefdeadbeef',
        issue: 'BAR-1',
        'issue.id': 99,
        title: 'TypeError: boom',
        level: 'error',
        timestamp: '2024-01-01T00:00:04+00:00',
        trace: TRACE,
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    expect(await screen.findByText('first log')).toBeInTheDocument();

    // Two different numbers, on purpose. The lanes carry each type's exact
    // aggregate, which sums to 7 here; the toolbar counts the rows actually in the
    // list, which is 4. Pairing the two in one "of" is what read `53 of 36`.
    expect(screen.getByText('4 items')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Logs 2'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Metrics 3'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Traces 1'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Errors 1'})).toBeInTheDocument();

    // Ordered by timestamp descending across kinds. A trace row is named by its
    // transaction, and sits on the rail like any other item.
    const items = railItems();
    expect(items).toHaveLength(4);
    expect(within(items[0]!).getByText('TypeError: boom')).toBeInTheDocument();
    expect(within(items[1]!).getByText('/checkout')).toBeInTheDocument();
    expect(within(items[2]!).getByText('checkout.latency')).toBeInTheDocument();
    expect(within(items[3]!).getByText('first log')).toBeInTheDocument();

    // Each row names its type in the singular, while the lane labels stay plural.
    expect(within(items[0]!).getByText('Error')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Trace')).toBeInTheDocument();
    expect(within(items[2]!).getByText('Metric')).toBeInTheDocument();
    expect(within(items[3]!).getByText('Log')).toBeInTheDocument();
    // The plural label belongs to the scrubber lane, not to a row.
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('places rows by their offset from the session start, and only traces carry a duration', async () => {
    mockEmptyDatasets(['logs', 'spans']);
    mockDataset('logs', 'count', [{'count()': 1}]);
    mockDataset('spans', 'count', [{'count_unique(trace)': 1}]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'first log',
        timestamp: '2024-01-01T00:00:00+00:00',
      },
    ]);
    mockDataset('spans', 'rows', [
      {
        id: 'abc123def4567890',
        'span.description': 'GET /api/thing',
        'span.duration': 250,
        timestamp: '2024-01-01T00:00:12+00:00',
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    const items = await waitFor(() => {
      const rows = railItems();
      expect(rows).toHaveLength(2);
      return rows;
    });

    // The span is 12s into the session; the log opens it.
    expect(within(items[0]!).getByText('0:12.00')).toBeInTheDocument();
    expect(within(items[1]!).getByText('0:00.00')).toBeInTheDocument();

    // Only the span reports a duration — the log is an instant.
    expect(within(items[0]!).getByText('250ms')).toBeInTheDocument();
    expect(within(items[1]!).queryByText(/ms$/)).not.toBeInTheDocument();
  });

  it('reads a gap between items off their offsets rather than marking it', async () => {
    mockEmptyDatasets(['logs']);
    mockDataset('logs', 'count', [{'count()': 2}]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'before the gap',
        timestamp: '2024-01-01T00:00:00+00:00',
      },
      {
        id: 'log2',
        message: 'after the gap',
        timestamp: '2024-01-01T00:01:00+00:00',
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    // A minute of nothing between two logs is two rows and a minute between
    // their offsets. What counts as quiet depends on how busy the session is,
    // which is a judgement the scrubber above is in a position to make and a row
    // separator is not.
    expect(await screen.findByText('after the gap')).toBeInTheDocument();
    expect(railItems()).toHaveLength(2);
    expect(screen.queryByText(/quiet/)).not.toBeInTheDocument();
    // Nothing sits between the two rows, not even a separator the listitem query
    // would skip over.
    expect(railItems()[0]!.parentElement!.children).toHaveLength(2);
    expect(within(railItems()[0]!).getByText('1:00.00')).toBeInTheDocument();
    expect(within(railItems()[1]!).getByText('0:00.00')).toBeInTheDocument();
  });

  it('renders one row per segment span, and asks the API for only those', async () => {
    const OTHER_TRACE = '2'.repeat(32);
    mockEmptyDatasets(['spans']);
    mockDataset('spans', 'count', [{'count_unique(trace)': 2}]);
    const rowsRequest = mockDataset('spans', 'rows', [
      {
        id: '1111111111111111',
        transaction: '/checkout',
        'span.op': 'navigation',
        'span.duration': 1200,
        timestamp: '2024-01-01T00:00:01+00:00',
        trace: TRACE,
      },
      {
        id: '3333333333333333',
        transaction: '/cart',
        'span.op': 'navigation',
        'span.duration': 300,
        timestamp: '2024-01-01T00:00:03+00:00',
        trace: OTHER_TRACE,
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    expect(await screen.findByText('/cart')).toBeInTheDocument();

    // One row per trace, named by its transaction and labelled as a trace rather
    // than as the span it was built from.
    const items = railItems();
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('/cart')).toBeInTheDocument();
    expect(within(items[1]!).getByText('/checkout')).toBeInTheDocument();
    expect(within(items[0]!).getAllByText('Trace')).not.toHaveLength(0);

    // The segment span's duration is the trace's, and it is shown.
    expect(within(items[1]!).getByText('1.20s')).toBeInTheDocument();

    // Nothing in a row navigates: the deep link lives in the panel the row opens.
    expect(within(items[1]!).queryByRole('link')).not.toBeInTheDocument();

    // Only segment spans are asked for — the individual spans of a trace are not
    // what the timeline is made of.
    expect(rowsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: `session.id:${SESSION_ID} is_transaction:true`,
        }),
      })
    );
  });

  it('keeps the domain around rows that fall outside the extent aggregates', async () => {
    mockEmptyDatasets(['spans']);
    // `min(precise.start_ts)` is sub-second; a row's `timestamp` is a coarser
    // column, so the row can sit slightly before an extent taken from the
    // aggregate alone. Anything drawn has to be inside the domain it is
    // positioned against — a trace at a negative offset used to reach its bar
    // back over the lane labels.
    mockDataset('spans', 'count', [
      {
        'count_unique(trace)': 1,
        'min(precise.start_ts)': 1704067200.59,
        'max(precise.finish_ts)': 1704067230,
      },
    ]);
    mockDataset('spans', 'rows', [
      {
        id: 'segment1',
        transaction: '/checkout',
        'span.duration': 250,
        timestamp: '2024-01-01T00:00:00+00:00',
        trace: TRACE,
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    // The domain runs from the row rather than from the aggregate, so the axis
    // measures the full 30s to the aggregate's end instead of the 29.41s between
    // the two aggregates — which is what left the row at a negative offset.
    expect(await screen.findByText('/checkout')).toBeInTheDocument();
    expect(within(railItems()[0]!).getByText('0:00.00')).toBeInTheDocument();
    expect(screen.getByText('0:30.00')).toBeInTheDocument();
    expect(screen.queryByText('0:29.41')).not.toBeInTheDocument();
  });

  it('counts distinct traces without narrowing to segment spans', async () => {
    mockEmptyDatasets(['spans']);
    // The extent aggregates come back even though no segment span does, which is
    // exactly the case this is about: the lane knows more than the rail can draw.
    const countRequest = mockDataset('spans', 'count', [
      {
        'count_unique(trace)': 9,
        'min(precise.start_ts)': 1704067200,
        'max(precise.finish_ts)': 1704067230,
      },
    ]);
    mockDataset('spans', 'rows', []);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    // The lane reports every trace the session touched, which is more than the
    // segment spans we can draw rows for.
    expect(await screen.findByRole('button', {name: 'Traces 9'})).toBeInTheDocument();
    expect(countRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: `session.id:${SESSION_ID}`,
          field: expect.arrayContaining(['count_unique(trace)']),
        }),
      })
    );
  });

  it('toggles the rail order, and asks the API for that order', async () => {
    mockEmptyDatasets(['logs']);
    mockDataset('logs', 'count', [{'count()': 2}]);
    const rowsRequest = mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'first log',
        timestamp: '2024-01-01T00:00:01+00:00',
      },
      {
        id: 'log2',
        message: 'second log',
        timestamp: '2024-01-01T00:00:02+00:00',
      },
    ]);

    const {router} = render(<SessionDetailView />, {
      organization,
      initialRouterConfig,
    });

    // Default: newest first, without needing a sort param in the URL.
    expect(await screen.findByText('second log')).toBeInTheDocument();
    expect(rowsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({sort: '-timestamp'}),
      })
    );
    expect(within(railItems()[0]!).getByText('second log')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Oldest first'}));

    expect(router.location.query.sort).toBe('timestamp');
    expect(rowsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({sort: 'timestamp'}),
      })
    );
    await waitFor(() => {
      expect(within(railItems()[0]!).getByText('first log')).toBeInTheDocument();
    });
  });

  it('links an error to the issue event, and a trace to its waterfall', async () => {
    mockEmptyDatasets(['errors', 'spans']);
    mockDataset('errors', 'count', [{'count()': 1}]);
    mockDataset('spans', 'count', [{'count_unique(trace)': 1}]);
    mockDataset('errors', 'rows', [
      {
        id: 'deadbeefdeadbeefdeadbeefdeadbeef',
        'issue.id': 99,
        title: 'TypeError: boom',
        timestamp: '2024-01-01T00:00:02+00:00',
        trace: TRACE,
      },
    ]);
    mockDataset('spans', 'rows', [
      {
        id: 'abc123def4567890',
        'span.description': 'GET /api/thing',
        timestamp: '2024-01-01T00:00:01+00:00',
        trace: TRACE,
        'transaction.span_id': 'fedcba9876543210',
        'project.id': Number(PROJECT.id),
      },
    ]);

    // Reading a link off the panel means opening the panel, which loads each
    // item's own body. None of that is what this test is about, so it is mocked
    // just enough to keep the reads from failing.
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/99/events/deadbeefdeadbeefdeadbeefdeadbeef/',
      method: 'GET',
      body: EventFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-trace/${TRACE}/`,
      method: 'GET',
      body: {transactions: [], orphan_errors: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-trace-meta/${TRACE}/`,
      method: 'GET',
      body: {
        errors: 0,
        performance_issues: 0,
        projects: 0,
        transactions: 0,
        transaction_child_count_map: [],
        span_count: 0,
        span_count_map: {},
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${PROJECT.slug}/trace-items/abc123def4567890/`,
      method: 'GET',
      body: {
        itemId: 'abc123def4567890',
        timestamp: '',
        attributes: [],
        meta: {},
      },
    });

    render(<SessionDetailView />, {organization, initialRouterConfig});

    // Opened from the row rather than followed from it: the row selects, and the
    // panel is what carries the way out.
    await userEvent.click(await screen.findByText('TypeError: boom'));
    const errorPanel = await screen.findByRole('complementary', {
      name: 'Telemetry details',
    });
    // `LinkButton` renders an anchor with role="button", so the panel's way out is a
    // button to ARIA even though it navigates.
    expect(within(errorPanel).getByRole('button', {name: 'Open Issue'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/99/events/deadbeefdeadbeefdeadbeefdeadbeef/'
    );

    await userEvent.click(screen.getByText('GET /api/thing'));
    const tracePanel = await screen.findByRole('complementary', {
      name: 'Telemetry details',
    });
    const traceHref = within(tracePanel)
      .getByRole('button', {name: 'Open Full Trace'})
      .getAttribute('href')!;
    expect(traceHref).toContain(`/traces/trace/${TRACE}/`);
    // The row stands for the whole trace, so nothing inside it is preselected.
    expect(traceHref).not.toContain('node=');
  });

  it('links a log to the logs explorer filtered to that log id', async () => {
    mockEmptyDatasets(['logs']);
    mockDataset('logs', 'count', [{'count()': 1}]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'first log',
        timestamp: '2024-01-01T00:00:01+00:00',
        trace: TRACE,
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    await userEvent.click(await screen.findByText('first log'));
    const panel = await screen.findByRole('complementary', {
      name: 'Telemetry details',
    });
    const href = within(panel)
      .getByRole('button', {name: 'Open in Logs'})
      .getAttribute('href')!;
    expect(href).toContain('/organizations/org-slug/explore/logs/');
    expect(href).toContain('logsQuery=id%3Alog1');
  });

  it('links a metric to the trace metrics tab', async () => {
    mockEmptyDatasets(['tracemetrics']);
    mockDataset('tracemetrics', 'count', [{'count(session.id)': 1}]);
    mockDataset('tracemetrics', 'rows', [
      {
        id: 'metric1',
        'metric.name': 'checkout.latency',
        value: 42,
        timestamp: '2024-01-01T00:00:01+00:00',
        trace: TRACE,
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    await userEvent.click(await screen.findByText('checkout.latency'));
    const panel = await screen.findByRole('complementary', {
      name: 'Telemetry details',
    });
    const href = within(panel)
      .getByRole('button', {name: 'Open in Trace'})
      .getAttribute('href')!;
    expect(href).toContain(`/traces/trace/${TRACE}/`);
    expect(href).toContain('tab=metrics');
  });

  it('draws a lane only for the telemetry types the session holds', async () => {
    mockEmptyDatasets(['logs']);
    mockDataset('logs', 'count', [{'count()': 2}]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'early log',
        timestamp: '2024-01-01T00:00:00+00:00',
      },
      {
        id: 'log2',
        message: 'late log',
        timestamp: '2024-01-01T00:01:00+00:00',
      },
    ]);

    const {router} = render(<SessionDetailView />, {
      organization,
      initialRouterConfig,
    });

    expect(await screen.findByRole('button', {name: 'Logs 2'})).toBeInTheDocument();
    // This session is logs and nothing else, so the other four lanes are absent
    // rather than drawn flat at zero.
    expect(screen.queryByRole('button', {name: 'Errors 0'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Traces 0'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Metrics 0'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Feedback 0'})).not.toBeInTheDocument();

    // And the lane that is left has moved up into the space rather than staying in
    // its slot: the first row under the axis — which is where the error lane would
    // otherwise be — is now the log lane, and clicking the session's start there
    // opens the first log.
    clickTrack(trackWithGeometry(), {
      clientX: 0,
      clientY: AXIS_HEIGHT + LANE_HEIGHT / 2,
    });
    await waitFor(() => {
      expect(router.location.query.item).toBe('logs:log1');
    });
  });

  it('brings the empty lanes back when the setting is turned off', async () => {
    mockEmptyDatasets(['logs']);
    mockDataset('logs', 'count', [{'count()': 2}]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'early log',
        timestamp: '2024-01-01T00:00:00+00:00',
      },
      {
        id: 'log2',
        message: 'late log',
        timestamp: '2024-01-01T00:01:00+00:00',
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    expect(await screen.findByRole('button', {name: 'Logs 2'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Errors 0'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Timeline settings'}));
    await userEvent.click(
      await screen.findByRole('option', {name: /Hide empty categories/})
    );

    // Every lane the session could have had is drawn now, flat at zero, so the
    // chart says what the session has none of as well as what it has.
    expect(await screen.findByRole('button', {name: 'Errors 0'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Traces 0'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Metrics 0'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Feedback 0'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Logs 2'})).toBeInTheDocument();
  });

  it('keeps an emptied lane while a window is what emptied it', async () => {
    // The lanes follow the session rather than the viewport: a zoom that leaves a
    // lane with nothing in it has to leave the lane there, or the chart would
    // reshuffle under the gesture that is reading it.
    mockEmptyDatasets(['logs']);
    mockDataset('logs', 'count', [{'count()': 2}]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'early log',
        timestamp: '2024-01-01T00:00:00+00:00',
      },
      {
        id: 'log2',
        message: 'late log',
        timestamp: '2024-01-01T00:01:00+00:00',
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    expect(await screen.findByText('early log')).toBeInTheDocument();

    const track = screen.getByRole('group', {name: 'Session time window'});
    track.focus();
    await userEvent.keyboard('{ArrowUp>5/}');

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Logs 0'})).toBeInTheDocument();
    });
  });

  it('hides a telemetry type from the scrubber lane it is labelled by', async () => {
    mockEmptyDatasets(['logs', 'errors']);
    mockDataset('logs', 'count', [{'count()': 1}]);
    mockDataset('errors', 'count', [{'count()': 1}]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'first log',
        timestamp: '2024-01-01T00:00:01+00:00',
      },
    ]);
    mockDataset('errors', 'rows', [
      {
        id: 'deadbeefdeadbeefdeadbeefdeadbeef',
        'issue.id': 99,
        title: 'TypeError: boom',
        timestamp: '2024-01-01T00:00:02+00:00',
      },
    ]);

    const {router} = render(<SessionDetailView />, {
      organization,
      initialRouterConfig,
    });

    // Every type is on by default, with no param in the URL.
    expect(await screen.findByText('first log')).toBeInTheDocument();
    expect(screen.getByText('TypeError: boom')).toBeInTheDocument();

    const logsLane = screen.getByRole('button', {
      name: 'Logs 1',
      pressed: true,
    });
    await userEvent.click(logsLane);

    expect(router.location.query.telemetryType).toEqual([
      'metrics',
      'traces',
      'errors',
      'feedback',
    ]);
    expect(screen.queryByText('first log')).not.toBeInTheDocument();
    expect(screen.getByText('TypeError: boom')).toBeInTheDocument();

    // The counts stay exact, whatever the rail shows — a hidden type's lane label
    // still reports what the session holds, and the toolbar says how much of the
    // list is hidden rather than only how much is left.
    expect(screen.getByText('1 of 2 items')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Logs 1', pressed: false})
    ).toBeInTheDocument();

    // And back on again.
    await userEvent.click(screen.getByRole('button', {name: 'Logs 1', pressed: false}));
    expect(await screen.findByText('first log')).toBeInTheDocument();
  });

  it('narrows the rail to a keyboard-selected window, and resets it', async () => {
    mockEmptyDatasets(['logs']);
    mockDataset('logs', 'count', [
      {
        'count()': 2,
        'min(timestamp)': undefined,
        'max(timestamp)': undefined,
      },
    ]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'early log',
        timestamp: '2024-01-01T00:00:00+00:00',
      },
      {
        id: 'log2',
        message: 'late log',
        timestamp: '2024-01-01T00:01:00+00:00',
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    expect(await screen.findByText('early log')).toBeInTheDocument();

    // The lane counts the whole session until a window narrows it.
    expect(screen.getByRole('button', {name: 'Logs 2'})).toBeInTheDocument();

    // Squeezing the window from both ends drops the items at the edges of the
    // session; `ArrowUp` zooms in by an eighth from each side per press.
    const track = screen.getByRole('group', {name: 'Session time window'});
    track.focus();
    await userEvent.keyboard('{ArrowUp>5/}');

    await waitFor(() => {
      expect(screen.queryByText('early log')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('late log')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing in the selected time range.')).toBeInTheDocument();

    // And the lane count follows the window down, while the session's own total
    // stays put as the figure the window is read against.
    expect(screen.getByRole('button', {name: 'Logs 0'})).toBeInTheDocument();
    expect(screen.getByText('0 of 2 items')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Reset zoom'}));
    expect(await screen.findByText('early log')).toBeInTheDocument();
    expect(screen.getByText('late log')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Logs 2'})).toBeInTheDocument();
  });

  describe('zoom', () => {
    /**
     * A one-minute session whose only telemetry is logs at the given offsets. The
     * extremes set the extent, so an offset in seconds is directly a percentage of
     * the width — pass 0 and 60 and every other number below is round.
     */
    function mockLogsAtSeconds(offsets: number[]) {
      mockEmptyDatasets(['logs']);
      mockDataset('logs', 'count', [{'count()': offsets.length}]);
      mockDataset(
        'logs',
        'rows',
        offsets.map((offset, index) => ({
          id: `log${index + 1}`,
          message: `log at ${offset}s`,
          timestamp: new Date(
            Date.parse('2024-01-01T00:00:00Z') + offset * 1000
          ).toISOString(),
        }))
      );
    }

    it('zooms the lanes around the pointer rather than their centre', async () => {
      mockLogsAtSeconds([0, 15, 60]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 15s')).toBeInTheDocument();

      // A quarter of the way along, which is the 15s log. Anchoring is the whole
      // claim here: a zoom about the *centre* would keep 30s and drop this, however
      // hard it was scrolled, and a zoom about the pointer keeps it at whatever
      // depth the wheel lands on.
      wheelTrack(trackWithGeometry(), {
        clientX: 250,
        clientY: laneY('Logs'),
        deltaY: -400,
      });

      await waitFor(() => {
        expect(screen.queryByText('log at 0s')).not.toBeInTheDocument();
      });
      expect(screen.getByText('log at 15s')).toBeInTheDocument();
      expect(screen.queryByText('log at 60s')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Reset zoom'})).toBeInTheDocument();
    });

    it('leaves the page its scroll when there is no zoom left to take', async () => {
      mockLogsAtSeconds([0, 60]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 0s')).toBeInTheDocument();

      const track = trackWithGeometry();
      // Zooming out at the full extent moves nothing, so the gesture is not the
      // chart's to swallow — otherwise the page cannot be scrolled past it.
      expect(
        wheelTrack(track, {clientX: 500, clientY: laneY('Logs'), deltaY: 200})
          .defaultPrevented
      ).toBe(false);

      // Zooming in does move something, so it is.
      expect(
        wheelTrack(track, {
          clientX: 500,
          clientY: laneY('Logs'),
          deltaY: -200,
        }).defaultPrevented
      ).toBe(true);
    });

    it('rescales the lanes to a dragged range, not just the rail', async () => {
      mockLogsAtSeconds([0, 30, 60]);

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByText('log at 30s')).toBeInTheDocument();

      // 100px to 600px of 1000px across a minute: 6s to 36s.
      dragTrack(trackWithGeometry(), {
        from: 100,
        to: 600,
        clientY: laneY('Logs'),
      });

      await waitFor(() => {
        expect(screen.queryByText('log at 0s')).not.toBeInTheDocument();
      });
      expect(
        screen.getByText(
          'Showing 0:06.00 to 0:36.00. Scroll to zoom, or drag the highlighted range above to move or resize it.'
        )
      ).toBeInTheDocument();

      // And the lane redrawn to that range is what makes this the test: 30s is now
      // four fifths of the way across rather than halfway, so a click at 800px
      // finds it only because the axis moved under it.
      clickTrack(trackWithGeometry(), {clientX: 800, clientY: laneY('Logs')});
      await waitFor(() => {
        expect(router.location.query.item).toBe('logs:log2');
      });
    });

    it('picks a range from the overview strip, which stays the whole session', async () => {
      mockLogsAtSeconds([0, 30, 60]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 30s')).toBeInTheDocument();

      // The strip is drawn against the session however far the lanes are zoomed, so
      // 700px of 1000px is 42s whatever else is going on.
      dragTrack(withGeometry(overviewStrip()), {
        from: 700,
        to: 1000,
        clientY: 10,
      });

      await waitFor(() => {
        expect(screen.queryByText('log at 30s')).not.toBeInTheDocument();
      });
      expect(screen.getByText('log at 60s')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Showing 0:42.00 to 1:00.00. Scroll to zoom, or drag the highlighted range above to move or resize it.'
        )
      ).toBeInTheDocument();
    });

    it('carries the range along when the strip drag starts inside it', async () => {
      mockLogsAtSeconds([0, 30, 60]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 30s')).toBeInTheDocument();

      // The session's first half, taken the ordinary way.
      dragTrack(withGeometry(overviewStrip()), {
        from: 0,
        to: 500,
        clientY: 10,
      });
      await waitFor(() => {
        expect(screen.queryByText('log at 60s')).not.toBeInTheDocument();
      });
      expect(screen.getByText('log at 0s')).toBeInTheDocument();

      // Now a drag that *starts* inside that range, which carries it instead of
      // replacing it: 250px to 500px slides it 15s along rather than selecting the
      // 15s-to-30s slice a fresh drag between those points would.
      dragTrack(withGeometry(overviewStrip()), {
        from: 250,
        to: 500,
        clientY: 10,
      });

      await waitFor(() => {
        expect(screen.queryByText('log at 0s')).not.toBeInTheDocument();
      });
      expect(screen.getByText('log at 30s')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Showing 0:15.00 to 0:45.00. Scroll to zoom, or drag the highlighted range above to move or resize it.'
        )
      ).toBeInTheDocument();
    });

    it('resizes the range when the strip drag starts on one of its ends', async () => {
      mockLogsAtSeconds([0, 30, 60]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 30s')).toBeInTheDocument();

      // 15s to 30s, taken the ordinary way.
      dragTrack(withGeometry(overviewStrip()), {
        from: 250,
        to: 500,
        clientY: 10,
      });
      await waitFor(() => {
        expect(screen.queryByText('log at 0s')).not.toBeInTheDocument();
      });

      // A drag from the frame's right edge takes that end to 48s and leaves the
      // other where it was — where a carry from the same point would have slid both.
      dragTrack(withGeometry(overviewStrip()), {
        from: 500,
        to: 800,
        clientY: 10,
      });
      expect(
        await screen.findByText(
          'Showing 0:15.00 to 0:48.00. Scroll to zoom, or drag the highlighted range above to move or resize it.'
        )
      ).toBeInTheDocument();

      // And the same from the left edge, outwards.
      dragTrack(withGeometry(overviewStrip()), {
        from: 250,
        to: 100,
        clientY: 10,
      });
      expect(
        await screen.findByText(
          'Showing 0:06.00 to 0:48.00. Scroll to zoom, or drag the highlighted range above to move or resize it.'
        )
      ).toBeInTheDocument();
    });

    it('says with the cursor what a press on the strip would do', async () => {
      mockLogsAtSeconds([0, 30, 60]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 30s')).toBeInTheDocument();

      const strip = withGeometry(overviewStrip());

      // Unzoomed the frame is the whole strip, so there is nothing to take hold of.
      pointerTrack(strip, 'pointermove', 375);
      expect(strip).toHaveStyle({cursor: 'crosshair'});

      dragTrack(strip, {from: 250, to: 500, clientY: 10});
      await waitFor(() => {
        expect(screen.queryByText('log at 0s')).not.toBeInTheDocument();
      });

      pointerTrack(strip, 'pointermove', 375);
      expect(strip).toHaveStyle({cursor: 'grab'});
      for (const end of [250, 500]) {
        pointerTrack(strip, 'pointermove', end);
        expect(strip).toHaveStyle({cursor: 'ew-resize'});
      }
      pointerTrack(strip, 'pointermove', 900);
      expect(strip).toHaveStyle({cursor: 'crosshair'});

      // Held rather than hovered, and held on the strip rather than on the frame:
      // the carry moves the frame out from under the pointer, so a rule that waited
      // on the frame would let go halfway through.
      pointerTrack(strip, 'pointerdown', 375);
      expect(strip).toHaveStyle({cursor: 'grabbing'});
      pointerTrack(strip, 'pointermove', 600);
      expect(strip).toHaveStyle({cursor: 'grabbing'});
      pointerTrack(strip, 'pointerup', 600);
    });
  });

  describe('idle compression', () => {
    /**
     * An hour-long session that spends almost all of itself doing nothing: three
     * logs at the start, three in the middle, three at the end. Two half-hour
     * stretches of nothing between them, which is the shape the axis exists to
     * compress.
     */
    function mockIdleSession() {
      const offsets = [0, 1, 2, 1800, 1801, 1802, 3598, 3599, 3600];
      mockEmptyDatasets(['logs']);
      mockDataset('logs', 'count', [{'count()': offsets.length}]);
      mockDataset(
        'logs',
        'rows',
        offsets.map(offset => ({
          id: `log${offset}`,
          message: `log at ${offset}s`,
          timestamp: new Date(
            Date.parse('2024-01-01T00:00:00Z') + offset * 1000
          ).toISOString(),
        }))
      );
    }

    beforeEach(() => {
      // The toggle is remembered across sessions, so a test that flips it would
      // otherwise decide what the next one is looking at.
      localStorage.clear();
    });

    it('compresses a stretch of nothing into a marked break', async () => {
      mockIdleSession();

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 1800s')).toBeInTheDocument();

      // Two stretches, each named by how much time it stands for — which is the
      // whole of what a break has to say, since it has no width to say it in.
      const breaks = screen.getAllByTestId('session-break');
      expect(breaks).toHaveLength(2);
      expect(screen.getByText('30.0m')).toBeInTheDocument();
      expect(screen.getByText('29.9m')).toBeInTheDocument();

      // A twenty-four pixel band out of the eight hundred the track is assumed to
      // have before jsdom measures it, which is three percent of the axis for a
      // stretch that is half of the session.
      expect(breaks[0]).toHaveStyle({width: '3%'});
      // The duration rides inside the break rather than beside it, so the cut and
      // what it stands for cannot be separated by a reflow.
      expect(within(breaks[0]!).getByText('30.0m')).toBeInTheDocument();
    });

    it('leaves a session alone when nothing is short of room', async () => {
      // Three logs five minutes apart. Both stretches between them are long enough
      // to count as idle — minutes of nothing, twice — and neither is worth a break:
      // three dots are three dots however the axis is drawn, so the marks either
      // side have all the room they need already.
      mockEmptyDatasets(['logs']);
      mockDataset('logs', 'count', [{'count()': 3}]);
      mockDataset('logs', 'rows', [
        {
          id: 'log1',
          message: 'log at 0s',
          timestamp: '2024-01-01T00:00:00+00:00',
        },
        {
          id: 'log2',
          message: 'log at 300s',
          timestamp: '2024-01-01T00:05:00+00:00',
        },
        {
          id: 'log3',
          message: 'log at 600s',
          timestamp: '2024-01-01T00:10:00+00:00',
        },
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 300s')).toBeInTheDocument();
      expect(screen.queryByTestId('session-break')).not.toBeInTheDocument();
      // And no switch, because there is nothing it could change.
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('draws the lanes on the compressed axis, not the linear one', async () => {
      mockIdleSession();

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByText('log at 1800s')).toBeInTheDocument();

      // Drawn linearly, 350px of 1000 is the twenty-first minute — a stretch of
      // this session where nothing at all happened. Compressed it is where the
      // middle logs begin, because the half-hour of nothing before them has been
      // taken out. The click finds them only because the axis moved under it.
      clickTrack(trackWithGeometry(), {clientX: 350, clientY: laneY('Logs')});

      await waitFor(() => {
        expect(router.location.query.item).toBe('logs:log1800');
      });
    });

    it('expands a break when it is clicked', async () => {
      mockIdleSession();

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 3600s')).toBeInTheDocument();

      // The first break, which the axis puts between the opening logs and the
      // middle ones. Clicking it hands that half-hour back rather than opening
      // anything: the stretch, and a little of what bracketed it, becomes the view.
      clickTrack(trackWithGeometry(), {clientX: 328, clientY: laneY('Logs')});

      await waitFor(() => {
        expect(screen.queryByText('log at 3600s')).not.toBeInTheDocument();
      });
      expect(screen.getByText('log at 0s')).toBeInTheDocument();
      expect(screen.getByText('log at 1800s')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Reset zoom'})).toBeInTheDocument();
    });

    it('expands a break that is almost the whole session', async () => {
      // Half an hour with three logs at each end and nothing at all in between,
      // which is the shape this feature is *for* — and the one where a margin
      // measured against the stretch overflows the session at both ends. A range
      // that wide reads as no selection at all, which left the click doing nothing.
      const offsets = [0, 1, 2, 1798, 1799, 1800];
      mockEmptyDatasets(['logs']);
      mockDataset('logs', 'count', [{'count()': offsets.length}]);
      mockDataset(
        'logs',
        'rows',
        offsets.map(offset => ({
          id: `log${offset}`,
          message: `log at ${offset}s`,
          timestamp: new Date(
            Date.parse('2024-01-01T00:00:00Z') + offset * 1000
          ).toISOString(),
        }))
      );

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 1798s')).toBeInTheDocument();
      expect(screen.getAllByTestId('session-break')).toHaveLength(1);

      // The break sits between the two clusters, just under half way across.
      clickTrack(trackWithGeometry(), {clientX: 500, clientY: laneY('Logs')});

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Reset zoom'})).toBeInTheDocument();
      });
      // Narrowed to the stretch itself, so the logs that bracket it are the only
      // things left at its edges and everything outside has dropped away.
      expect(screen.queryByText('log at 0s')).not.toBeInTheDocument();
      expect(screen.queryByText('log at 1800s')).not.toBeInTheDocument();
    });

    it('gives the axis back when the setting is turned off', async () => {
      mockIdleSession();

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('log at 1800s')).toBeInTheDocument();
      expect(screen.getAllByTestId('session-break')).toHaveLength(2);

      await userEvent.click(screen.getByRole('button', {name: 'Timeline settings'}));
      await userEvent.click(await screen.findByRole('option', {name: /Hide inactivity/}));

      expect(screen.queryByTestId('session-break')).not.toBeInTheDocument();
    });
  });

  it('filters the rail by a free-text search over title and detail', async () => {
    mockEmptyDatasets(['logs']);
    mockDataset('logs', 'count', [{'count()': 2}]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'checkout failed',
        severity: 'error',
        timestamp: '2024-01-01T00:00:01+00:00',
      },
      {
        id: 'log2',
        message: 'user signed in',
        severity: 'info',
        timestamp: '2024-01-01T00:00:02+00:00',
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    expect(await screen.findByText('checkout failed')).toBeInTheDocument();

    const search = screen.getByRole('textbox', {name: 'Search telemetry'});
    await userEvent.type(search, 'CHECKOUT');

    // Case-insensitive match on the title.
    await waitFor(() => {
      expect(screen.queryByText('user signed in')).not.toBeInTheDocument();
    });
    expect(screen.getByText('checkout failed')).toBeInTheDocument();

    // The detail line is searchable too: `severity` is what a log row shows there.
    await userEvent.clear(search);
    await userEvent.type(search, 'info');
    await waitFor(() => {
      expect(screen.getByText('user signed in')).toBeInTheDocument();
    });
    expect(screen.queryByText('checkout failed')).not.toBeInTheDocument();

    // Nothing matching reads as a filtered-out rail, not an empty session.
    await userEvent.clear(search);
    await userEvent.type(search, 'nothing matches this');
    expect(
      await screen.findByText('No telemetry matches these filters.')
    ).toBeInTheDocument();
  });

  it('renders a row unlinked when it lacks the ids needed to build a target', async () => {
    mockEmptyDatasets(['spans']);
    mockDataset('spans', 'count', [{'count_unique(trace)': 1}]);
    // No trace id, so there is no waterfall to link into.
    mockDataset('spans', 'rows', [
      {
        id: 'abc123def4567890',
        'span.description': 'orphan span',
        timestamp: '2024-01-01T00:00:01+00:00',
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    expect(await screen.findByText('orphan span')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /orphan span/})).not.toBeInTheDocument();
  });

  it('follows the cursor to read a dataset that spans several pages', async () => {
    mockEmptyDatasets(['spans']);
    mockDataset('spans', 'count', [{'count_unique(trace)': 2}]);

    // The spans dataset is capped at 100 rows per request by the events endpoint, so the
    // timeline reads them a page at a time.
    const firstPage = mockRowsPage('spans', {
      cursor: undefined,
      nextCursor: '0:100:0',
      data: [
        {
          id: 'span1',
          'span.description': 'first page span',
          timestamp: '2024-01-01T00:00:02+00:00',
        },
      ],
    });
    const secondPage = mockRowsPage('spans', {
      cursor: '0:100:0',
      data: [
        {
          id: 'span2',
          'span.description': 'second page span',
          timestamp: '2024-01-01T00:00:01+00:00',
        },
      ],
    });

    render(<SessionDetailView />, {organization, initialRouterConfig});

    // Both pages land on one rail, in timestamp order rather than fetch order.
    expect(await screen.findByText('first page span')).toBeInTheDocument();
    expect(screen.getByText('second page span')).toBeInTheDocument();
    expect(firstPage).toHaveBeenCalledTimes(1);
    expect(secondPage).toHaveBeenCalledTimes(1);

    // The last page said it had no successor, so nothing was left behind.
    expect(screen.queryByText(/may be incomplete/)).not.toBeInTheDocument();
  });

  it('stops paging at the row budget and says the timeline is partial', async () => {
    mockEmptyDatasets(['spans']);
    mockDataset('spans', 'count', [{'count_unique(trace)': 5000}]);

    // Every page claims another one behind it, so paging stops on its own budget
    // rather than on the session running out of spans.
    const page = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {
        data: [
          {
            id: 'span1',
            'span.description': 'a span',
            timestamp: '2024-01-01T00:00:01+00:00',
          },
        ],
        meta: {fields: {}},
      },
      headers: {
        Link: '<https://sentry.io/next>; rel="next"; results="true"; cursor="0:100:0"',
      },
      match: [
        (_url: string, options: Record<string, any>) =>
          options.query.dataset === 'spans' &&
          !isRouteQuery(options) &&
          options.query.field.includes('timestamp'),
      ],
    });

    render(<SessionDetailView />, {organization, initialRouterConfig});

    expect(await screen.findByText(/may be incomplete/)).toBeInTheDocument();

    // 1000 rows at 100 per request is ten pages, and the budget is a hard stop —
    // a dataset that never stops advertising a next page cannot loop forever.
    await waitFor(() => expect(page).toHaveBeenCalledTimes(10));
  });

  it('measures the session from the extent aggregates, not from the fetched rows', async () => {
    mockEmptyDatasets(['logs']);
    // The session started a minute before the only row that came back, which is
    // what a truncated page looks like.
    mockDataset('logs', 'count', [
      {
        'count()': 1,
        'min(timestamp_precise)': 1704067200e9,
        'max(timestamp_precise)': 1704067320e9,
      },
    ]);
    mockDataset('logs', 'rows', [
      {
        id: 'log1',
        message: 'the only row',
        timestamp: '2024-01-01T00:01:00+00:00',
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    // Offset is measured from the aggregate start (00:00:00), so the row sits a
    // minute in rather than at zero.
    expect(await screen.findByText('1:00.00')).toBeInTheDocument();
  });

  describe('details panel', () => {
    /** One log, and the attributes the panel fetches for it. */
    function mockOneLog(id = 'log1', message = 'first log') {
      mockEmptyDatasets(['logs']);
      mockDataset('logs', 'count', [{'count()': 1}]);
      mockDataset('logs', 'rows', [
        {
          id,
          message,
          severity: 'INFO',
          timestamp: '2024-01-01T00:00:01+00:00',
          trace: TRACE,
          'project.id': Number(PROJECT.id),
        },
      ]);
      return mockTraceItem(id, [
        {name: 'message', type: 'str', value: message},
        {name: 'special_field', type: 'str', value: 'special value'},
      ]);
    }

    function mockTraceItem(id: string, attributes: unknown[]) {
      return MockApiClient.addMockResponse({
        url: `/projects/org-slug/${PROJECT.slug}/trace-items/${id}/`,
        method: 'GET',
        body: {
          itemId: id,
          timestamp: '2024-01-01T00:00:01+00:00',
          attributes,
          meta: {},
        },
      });
    }

    it('opens a rail row in the panel, and keeps the selection in the URL', async () => {
      const detailsRequest = mockOneLog();

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByText('first log')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Show details'}));

      // The panel says what kind of thing it is, then the item's own attributes.
      const panel = await screen.findByRole('complementary', {
        name: 'Telemetry details',
      });
      expect(within(panel).getByText('Log')).toBeInTheDocument();
      expect(await within(panel).findByText('special value')).toBeInTheDocument();
      expect(detailsRequest).toHaveBeenCalled();

      // Linkable, so a single item in a session can be handed to someone else.
      expect(router.location.query.item).toBe('logs:log1');

      // And the same button closes it again.
      await userEvent.click(screen.getByRole('button', {name: 'Hide details'}));
      await waitFor(() => {
        expect(router.location.query.item).toBeUndefined();
      });
    });

    it('opens the panel from a linked selection', async () => {
      mockOneLog();

      render(<SessionDetailView />, {
        organization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {item: 'logs:log1'},
          },
        },
      });

      const panel = await screen.findByRole('complementary', {
        name: 'Telemetry details',
      });
      expect(await within(panel).findByText('special value')).toBeInTheDocument();
    });

    it('clears the selection when the panel is closed', async () => {
      mockOneLog();

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {item: 'logs:log1'},
          },
        },
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Close Drawer'}));
      await waitFor(() => {
        expect(router.location.query.item).toBeUndefined();
      });
    });

    it('opens the panel from the title rather than navigating away', async () => {
      mockOneLog();

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig,
      });

      // The title used to be a link, which made the most obvious thing to click the
      // one that left the session behind. Clicking it now selects the item like the
      // rest of the row.
      await userEvent.click(await screen.findByText('first log'));

      await waitFor(() => {
        expect(router.location.query.item).toBe('logs:log1');
      });
      expect(router.location.pathname).toBe(
        `/organizations/org-slug/explore/usersessions/${SESSION_ID}/`
      );
    });

    it('opens an item clicked in a scrubber lane, and marks its row', async () => {
      mockEmptyDatasets(['logs']);
      mockDataset('logs', 'count', [{'count()': 3}]);
      mockDataset('logs', 'rows', [
        {
          id: 'log1',
          message: 'first log',
          timestamp: '2024-01-01T00:00:01+00:00',
          'project.id': Number(PROJECT.id),
        },
        {
          id: 'log2',
          message: 'second log',
          timestamp: '2024-01-01T00:00:02+00:00',
          trace: TRACE,
          'project.id': Number(PROJECT.id),
        },
        {
          id: 'log3',
          message: 'third log',
          timestamp: '2024-01-01T00:00:03+00:00',
          'project.id': Number(PROJECT.id),
        },
      ]);
      mockTraceItem('log2', [{name: 'special_field', type: 'str', value: 'the middle'}]);

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByText('second log')).toBeInTheDocument();

      // jsdom measures everything as zero, and the lanes are read by geometry:
      // which lane from the pointer's y, which item from its x.
      const track = trackWithGeometry();

      // The session spans 1s to 3s over 1000px, so the middle log sits at 500px.
      clickTrack(track, {clientX: 500, clientY: laneY('Logs')});

      const panel = await screen.findByRole('complementary', {
        name: 'Telemetry details',
      });
      expect(await within(panel).findByText('the middle')).toBeInTheDocument();
      expect(router.location.query.item).toBe('logs:log2');

      // The rail marks the row the lane pointed at, so the two read as one view.
      const selected = railItems().filter(
        item => item.getAttribute('aria-current') === 'true'
      );
      expect(selected).toHaveLength(1);
      expect(within(selected[0]!).getByText('second log')).toBeInTheDocument();
    });

    it('keeps the zoom when empty lane space is clicked', async () => {
      mockEmptyDatasets(['logs']);
      mockDataset('logs', 'count', [{'count()': 2}]);
      mockDataset('logs', 'rows', [
        {
          id: 'log1',
          message: 'early log',
          timestamp: '2024-01-01T00:00:00+00:00',
        },
        {
          id: 'log2',
          message: 'late log',
          timestamp: '2024-01-01T00:01:00+00:00',
        },
      ]);

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByText('early log')).toBeInTheDocument();

      const track = trackWithGeometry();
      track.focus();
      await userEvent.keyboard('{ArrowUp>5/}');
      await waitFor(() => {
        expect(
          screen.getByText('Nothing in the selected time range.')
        ).toBeInTheDocument();
      });

      // Halfway along a lane whose only items are at either end: nothing to open,
      // and a zoom is too expensive to build to be thrown away by a stray click.
      clickTrack(track, {clientX: 500, clientY: laneY('Logs')});

      expect(screen.getByText('Nothing in the selected time range.')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Reset zoom'})).toBeInTheDocument();
      expect(router.location.query.item).toBeUndefined();

      // Which leaves the button as the way back.
      await userEvent.click(screen.getByRole('button', {name: 'Reset zoom'}));
      expect(await screen.findByText('early log')).toBeInTheDocument();
      expect(screen.getByText('late log')).toBeInTheDocument();
    });

    it('hits a trace anywhere along its duration, and shows its waterfall', async () => {
      mockEmptyDatasets(['spans']);
      mockDataset('spans', 'count', [{'count_unique(trace)': 1}]);
      mockDataset('spans', 'rows', [
        // Starts at the very beginning of the session and runs for half of it.
        {
          id: 'segment1',
          transaction: '/checkout',
          'span.op': 'navigation',
          'span.duration': 1000,
          timestamp: '2024-01-01T00:00:00+00:00',
          trace: TRACE,
          'project.id': Number(PROJECT.id),
        },
        {
          id: 'segment2',
          transaction: '/done',
          'span.op': 'navigation',
          'span.duration': 10,
          timestamp: '2024-01-01T00:00:02+00:00',
          trace: TRACE,
          'project.id': Number(PROJECT.id),
        },
      ]);
      // What the trace view's own waterfall reads, which is what the panel now
      // hands the trace off to.
      const traceRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/events-trace/${TRACE}/`,
        method: 'GET',
        body: {transactions: [], orphan_errors: []},
      });
      const traceMetaRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/events-trace-meta/${TRACE}/`,
        method: 'GET',
        body: {
          errors: 0,
          performance_issues: 0,
          projects: 0,
          transactions: 0,
          transaction_child_count_map: [],
          span_count: 0,
          span_count_map: {},
        },
      });
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/${PROJECT.slug}/trace-items/segment1/`,
        method: 'GET',
        body: {itemId: 'segment1', timestamp: '', attributes: [], meta: {}},
      });

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByText('/checkout')).toBeInTheDocument();

      // The session spans 0s to 2.01s over 1000px, so a quarter of the way in is
      // well past the trace's start but still inside its 1s duration. A dot-based
      // lane would miss it.
      const track = trackWithGeometry();
      clickTrack(track, {clientX: 250, clientY: laneY('Traces')});

      expect(router.location.query.item).toBe('traces:segment1');

      const panel = await screen.findByRole('complementary', {
        name: 'Telemetry details',
      });
      // The waterfall's own toolbar, so the panel is showing the real thing rather
      // than a preview of its own.
      expect(
        await within(panel).findByPlaceholderText('Search in trace')
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(traceRequest).toHaveBeenCalled();
      });
      expect(traceMetaRequest).toHaveBeenCalled();
    });

    it('shows an error with the sections the trace drawer gives an event', async () => {
      mockEmptyDatasets(['errors']);
      mockDataset('errors', 'count', [{'count()': 1}]);
      mockDataset('errors', 'rows', [
        {
          id: 'deadbeefdeadbeefdeadbeefdeadbeef',
          'issue.id': 99,
          title: 'TypeError: boom',
          level: 'error',
          timestamp: '2024-01-01T00:00:01+00:00',
          trace: TRACE,
          'project.id': Number(PROJECT.id),
        },
      ]);

      const eventRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/99/events/deadbeefdeadbeefdeadbeefdeadbeef/',
        method: 'GET',
        body: EventFixture({
          id: 'deadbeefdeadbeefdeadbeefdeadbeef',
          projectSlug: PROJECT.slug,
          culprit: 'checkout(app)',
          tags: [{key: 'browser', value: 'Chrome 120.0.0'}],
          entries: [
            {
              type: EntryType.BREADCRUMBS,
              data: {
                values: [
                  {
                    type: BreadcrumbType.UI,
                    category: 'ui.click',
                    message: 'pressed pay now',
                    level: BreadcrumbLevelType.INFO,
                    timestamp: '2024-01-01T00:00:00Z',
                  },
                ],
              },
            },
          ],
        }),
      });

      // The highlights section reads the project's configured highlight fields.
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/${PROJECT.slug}/`,
        method: 'GET',
        body: PROJECT,
      });

      render(<SessionDetailView />, {
        organization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {item: 'errors:deadbeefdeadbeefdeadbeefdeadbeef'},
          },
        },
      });

      const panel = await screen.findByRole('complementary', {
        name: 'Telemetry details',
      });

      // Not just a stack trace: the same sections the waterfall's drawer gives an
      // event, including what the user did before it went wrong.
      // Their contents are measured against a container width and a scroll box,
      // neither of which jsdom has, so the sections being there is what is
      // assertable here.
      expect(await within(panel).findByText('Highlights')).toBeInTheDocument();
      expect(within(panel).getByText('Tags')).toBeInTheDocument();
      expect(within(panel).getByText('Breadcrumbs')).toBeInTheDocument();
      expect(eventRequest).toHaveBeenCalled();
    });

    it('takes the panel with it when a row link leaves the page', async () => {
      mockOneLog();

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {item: 'logs:log1'},
          },
        },
      });

      const panel = await screen.findByRole('complementary', {
        name: 'Telemetry details',
      });

      // The header's own way out of the panel, which lands on another page.
      await userEvent.click(
        await within(panel).findByRole('button', {name: 'Open in Logs'})
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe('/organizations/org-slug/explore/logs/');
      });

      // Gone with the page it belonged to, and without dragging the URL back to it.
      expect(
        screen.queryByRole('complementary', {name: 'Telemetry details'})
      ).not.toBeInTheDocument();
      expect(router.location.pathname).toBe('/organizations/org-slug/explore/logs/');
    });
  });

  describe('session health', () => {
    /** A session holding `count` errors, one of which is on the rail. */
    function mockErroredSession(count: number, unhandled: boolean) {
      mockEmptyDatasets(['errors']);
      mockDataset('errors', 'count', [
        {
          'count()': count,
          'min(timestamp)': '2024-01-01T00:00:00+00:00',
          'max(timestamp)': '2024-01-01T00:00:10+00:00',
        },
      ]);
      mockDataset('errors', 'rows', [
        {
          id: 'e'.repeat(32),
          timestamp: '2024-01-01T00:00:05+00:00',
          title: 'TypeError: undefined is not a function',
          level: 'error',
          'error.unhandled': unhandled,
          'issue.id': 42,
          trace: TRACE,
          'project.id': Number(PROJECT.id),
        },
      ]);
    }

    it('calls a session with an unhandled error crashed', async () => {
      mockErroredSession(3, true);
      const unhandled = mockUnhandled(1);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('Crashed')).toBeInTheDocument();

      // The verdict comes from an aggregate over every error, not from the rail's
      // rows: those are capped newest-first, so a crash early in a chatty session
      // would not be among them.
      expect(unhandled).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'errors',
            query: `session.id:${SESSION_ID} error.unhandled:true`,
            field: ['count()'],
          }),
        })
      );

      // And the row says which error it was, since that is the one to open.
      expect(await screen.findByText('unhandled')).toBeInTheDocument();
    });

    it('calls a session that handled all of its errors errored', async () => {
      mockErroredSession(2, false);
      mockUnhandled(0);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('Errored')).toBeInTheDocument();
      expect(screen.queryByText('Crashed')).not.toBeInTheDocument();
      // The level stands in for the detail when nothing went unhandled.
      expect(screen.getByText('error')).toBeInTheDocument();
      expect(screen.queryByText('unhandled')).not.toBeInTheDocument();
    });

    it('calls a session with no errors healthy', async () => {
      mockEmptyDatasets();
      mockUnhandled(0);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('Healthy')).toBeInTheDocument();
    });

    it('withholds a verdict rather than flashing one while errors are counted', async () => {
      mockEmptyDatasets();
      mockUnhandled(0);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      // Nothing at all before the counts land: "Healthy" mid-load would turn red
      // a moment later on any session that did error.
      expect(screen.queryByText('Healthy')).not.toBeInTheDocument();
      expect(screen.queryByText('Errored')).not.toBeInTheDocument();
      expect(screen.queryByText('Crashed')).not.toBeInTheDocument();

      expect(await screen.findByText('Healthy')).toBeInTheDocument();
    });
  });

  describe('web vitals', () => {
    it('shows the session score and a pill per vital it reported', async () => {
      mockEmptyDatasets();
      const vitals = mockVitals([
        vitalsRow({
          total: 0.84,
          lcp: {score: 0.72, count: 3, value: 2500},
          cls: {score: 0.96, count: 2, value: 0.045},
        }),
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('Score')).toBeInTheDocument();
      // Ratios out of one on the wire, out of a hundred on the page.
      expect(screen.getByText('84')).toBeInTheDocument();

      expect(screen.getByText('LCP')).toBeInTheDocument();
      expect(screen.getByText('2.50s')).toBeInTheDocument();
      expect(screen.getByText('CLS')).toBeInTheDocument();
      expect(screen.getByText('0.05')).toBeInTheDocument();

      // Every vital keeps its pill, measured or not: an absent one is
      // indistinguishable from a broken query. The three with no reading show a
      // dash rather than a zero, which would accuse the session of scoring badly.
      expect(screen.getByText('INP')).toBeInTheDocument();
      expect(screen.getByText('TTFB')).toBeInTheDocument();
      expect(screen.getByText('FCP')).toBeInTheDocument();
      expect(screen.getAllByText('\u2014')).toHaveLength(3);

      // The score is renormalised over whatever was measured, so a session
      // holding only LCP (30) and CLS (15) still reads out of 100 while covering
      // 45 points of one. Saying the number without saying its coverage would
      // overstate it every time, so the tooltip carries both.
      await userEvent.hover(screen.getByText('Score'));
      expect(
        await screen.findByText(/which is 45 of the 100 points/)
      ).toBeInTheDocument();

      // One aggregate read over the whole session, not one per pageload.
      expect(vitals).toHaveBeenCalledTimes(1);
      expect(vitals).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            query: `session.id:${SESSION_ID}`,
            field: expect.arrayContaining([
              'performance_score(measurements.score.total)',
              'performance_score(measurements.score.lcp)',
              'count_scores(measurements.score.lcp)',
              'avg(browser.web_vital.lcp.value)',
            ]),
          }),
        })
      );
    });

    it('says nothing at all for a session with no browser telemetry', async () => {
      mockEmptyDatasets();
      // What the endpoint actually answers for a session that has spans but no
      // scored ones: a row of zeroes rather than no row.
      mockVitals([vitalsRow({total: 0})]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      // Waited on so the assertion is about a settled page rather than one that
      // simply hasn't rendered the pills yet.
      expect(
        await screen.findByText('No telemetry found for this session.')
      ).toBeInTheDocument();
      expect(screen.queryByText('Score')).not.toBeInTheDocument();
      expect(screen.queryByText('LCP')).not.toBeInTheDocument();
    });

    it('does not hold up the timeline when the vitals query fails', async () => {
      mockEmptyDatasets(['spans']);
      mockDataset('spans', 'count', [{'count_unique(trace)': 1}]);
      mockDataset('spans', 'rows', [
        {
          id: 'a'.repeat(16),
          timestamp: '2024-01-01T00:00:00+00:00',
          transaction: '/checkout',
          'span.op': 'pageload',
          'span.duration': 120,
          trace: TRACE,
          'project.id': Number(PROJECT.id),
        },
      ]);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        method: 'GET',
        statusCode: 500,
        body: {},
        match: [(_url: string, options: Record<string, any>) => isVitalsQuery(options)],
      });

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('/checkout')).toBeInTheDocument();
      expect(screen.queryByText('Score')).not.toBeInTheDocument();
    });
  });

  describe('route band', () => {
    /**
     * A session running from 0s to 60s, so a visit's width is directly readable as
     * a percentage of it. The extent comes from the aggregates, not from the rows,
     * which is what lets the band be tested without any telemetry rows at all.
     */
    function mockSixtySecondSession() {
      mockEmptyDatasets(['spans']);
      mockDataset('spans', 'count', [
        {
          'count_unique(trace)': 3,
          'min(precise.start_ts)': Date.parse('2024-01-01T00:00:00Z') / 1000,
          'max(precise.finish_ts)': Date.parse('2024-01-01T00:01:00Z') / 1000,
        },
      ]);
      mockDataset('spans', 'rows', []);
    }

    function routeSegments() {
      return screen.getAllByTestId('route-visit');
    }

    it('draws one segment per stay, sized by how long the user stayed', async () => {
      mockSixtySecondSession();
      const arrivals = mockRouteVisits([
        {
          timestamp: '2024-01-01T00:00:00+00:00',
          'span.op': 'pageload',
          'span.name': '/',
        },
        {
          timestamp: '2024-01-01T00:00:20+00:00',
          'span.op': 'navigation',
          'span.name': '/cart',
        },
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('Route')).toBeInTheDocument();

      const segments = routeSegments();
      expect(segments).toHaveLength(2);

      // A third of the session on `/`, the remaining two thirds on `/cart` — from
      // the gap between arrivals, not from either span's own duration.
      expect(segments[0]).toHaveStyle({
        left: '0%',
        width: '33.33333333333333%',
      });
      expect(segments[1]).toHaveStyle({
        left: '33.33333333333333%',
        width: '66.66666666666667%',
      });

      // The dwell time and how they got there ride along with the route, so a
      // clipped or dropped label still says what the segment is.
      expect(segments[0]).toHaveAttribute('title', '/ · 20.0s · 0:00.00 page load');
      expect(segments[1]).toHaveAttribute('title', '/cart · 40.0s · 0:20.00 navigation');

      // Arrivals are asked for on their own, narrowed by op — not filtered out of
      // the trace rows, which are capped and sorted the other way.
      expect(arrivals).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            // Narrowed by op alone. `is_transaction:true` would drop redirect
            // arrivals, which the SDK records as child spans rather than segments;
            // it is selected as a field instead, since it decides which field names
            // a row's route.
            query: `session.id:${SESSION_ID} span.op:[pageload,navigation,navigation.redirect]`,
            sort: 'timestamp',
          }),
        })
      );
      expect(arrivals.mock.calls[0]![1].query.field).toContain('span.name');
    });

    it('draws a redirect arrival, which is a child span in someone else s trace', async () => {
      // A trace whose root segment is a ui.action.click, with the arrival recorded
      // inside it as `navigation.redirect`. Its `transaction` is the click's route,
      // so naming it from that field would merge it away as "already there".
      mockSixtySecondSession();
      mockRouteVisits([
        {
          timestamp: '2024-01-01T00:00:00+00:00',
          'span.op': 'pageload',
          'span.name': '/products',
          transaction: '/products',
        },
        // Stamped with the *other* segment's name in this trace, which is the route
        // being left. Its own span name is where it went.
        {
          timestamp: '2024-01-01T00:00:20+00:00',
          'span.op': 'navigation.redirect',
          'span.name': '/cart',
          transaction: '/products',
        },
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('Route')).toBeInTheDocument();

      const segments = screen.getAllByTestId('route-visit');
      expect(segments).toHaveLength(2);
      expect(segments[1]).toHaveAttribute('title', '/cart · 40.0s · 0:20.00 redirect');
    });

    it('narrows the timeline to a route when its segment is clicked', async () => {
      mockEmptyDatasets(['spans', 'logs']);
      mockDataset('spans', 'count', [
        {
          'count_unique(trace)': 1,
          'min(precise.start_ts)': Date.parse('2024-01-01T00:00:00Z') / 1000,
          'max(precise.finish_ts)': Date.parse('2024-01-01T00:01:00Z') / 1000,
        },
      ]);
      mockDataset('spans', 'rows', []);
      mockDataset('logs', 'count', [{'count()': 2}]);
      mockDataset('logs', 'rows', [
        {
          id: 'log1',
          message: 'on the home page',
          timestamp: '2024-01-01T00:00:05+00:00',
        },
        {
          id: 'log2',
          message: 'in the cart',
          timestamp: '2024-01-01T00:00:40+00:00',
        },
      ]);
      mockRouteVisits([
        {
          timestamp: '2024-01-01T00:00:00+00:00',
          'span.op': 'pageload',
          'span.name': '/',
        },
        {
          timestamp: '2024-01-01T00:00:20+00:00',
          'span.op': 'navigation',
          'span.name': '/cart',
        },
      ]);

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByText('on the home page')).toBeInTheDocument();
      expect(screen.getByText('in the cart')).toBeInTheDocument();

      // A route already is a span of time, so clicking one performs the drag the
      // user would otherwise have to aim by hand.
      clickTrack(trackWithGeometry(1000, 258), {
        clientX: 100,
        clientY: ROUTE_Y,
      });

      await waitFor(() => {
        expect(screen.queryByText('in the cart')).not.toBeInTheDocument();
      });
      expect(screen.getByText('on the home page')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Reset zoom'})).toBeInTheDocument();

      // And the lanes have rescaled to the visit rather than merely being veiled
      // over: `/` ran for the session's first 20s, so the log at 5s now sits a
      // quarter of the way across instead of a twelfth.
      clickTrack(trackWithGeometry(1000, 258), {
        clientX: 250,
        clientY: laneY('Logs'),
      });
      await waitFor(() => {
        expect(router.location.query.item).toBe('logs:log1');
      });
    });

    it('asks for no more arrivals than the spans dataset will serve', async () => {
      // The events endpoint *rejects* a per_page over a dataset's cap rather than
      // clamping it, so asking for more 400s every request and the band silently
      // never appears. Pinned here because the failure is invisible from the UI.
      mockSixtySecondSession();
      const arrivals = mockRouteVisits([]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      await waitFor(() => expect(arrivals).toHaveBeenCalled());
      const [, options] = arrivals.mock.calls[0]!;
      expect(options.query.per_page).toBeLessThanOrEqual(100);
    });

    it('says so when the band failed to load rather than showing nothing', async () => {
      mockSixtySecondSession();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        method: 'GET',
        statusCode: 400,
        body: {detail: 'Invalid per_page value.'},
        match: [(_url: string, options: Record<string, any>) => isRouteQuery(options)],
      });

      render(<SessionDetailView />, {organization, initialRouterConfig});

      // The row stays: a band that broke and a session that never navigated are
      // different answers, and only the row can tell them apart.
      expect(await screen.findByText('Route')).toBeInTheDocument();
      expect(screen.queryAllByTestId('route-visit')).toHaveLength(0);

      await userEvent.hover(screen.getByText('*'));
      expect(
        await screen.findByText('Routes failed to load, so this band is missing.')
      ).toBeInTheDocument();

      // And it stays a missing band, not a broken timeline.
      expect(
        screen.queryByText('Failed to load session telemetry.')
      ).not.toBeInTheDocument();
    });

    it('leaves the band out entirely when the session visited no routes', async () => {
      mockEmptyDatasets(['logs']);
      mockDataset('logs', 'count', [{'count()': 1}]);
      mockDataset('logs', 'rows', [
        {
          id: 'log1',
          message: 'a backend log',
          timestamp: '2024-01-01T00:00:00+00:00',
        },
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('a backend log')).toBeInTheDocument();

      // An empty labelled row would read as "this session visited nothing" rather
      // than "routes aren't a thing here".
      expect(screen.queryByText('Route')).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('route-visit')).toHaveLength(0);
    });

    it('merges a re-arrival landing in the same instant into one stay', async () => {
      mockSixtySecondSession();
      mockRouteVisits([
        {
          timestamp: '2024-01-01T00:00:00+00:00',
          'span.op': 'pageload',
          'span.name': '/cart',
        },
        // A query-param change firing a second navigation span within the same
        // instant. Not the user leaving and coming back, so not a second segment.
        {
          timestamp: '2024-01-01T00:00:00.400+00:00',
          'span.op': 'navigation',
          'span.name': '/cart',
        },
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('Route')).toBeInTheDocument();
      const segments = routeSegments();
      expect(segments).toHaveLength(1);
      expect(segments[0]).toHaveAttribute('title', '/cart · 1.0m · 0:00.00 page load');
    });

    it('draws a navigation back to the route the user was already on', async () => {
      // The reported bug. Every naming field on the arrival says `/`, and so did the
      // route before it, so the old name-only merge discarded a real router.push and
      // the band showed no arrival at the moment it happened.
      mockSixtySecondSession();
      mockRouteVisits([
        {
          timestamp: '2024-01-01T00:00:00+00:00',
          'span.op': 'navigation',
          'span.name': '/',
          'span.description': '/',
          transaction: '/',
        },
        {
          timestamp: '2024-01-01T00:00:20+00:00',
          'span.op': 'navigation',
          'span.name': '/',
          'span.description': '/',
          transaction: '/',
        },
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('Route')).toBeInTheDocument();
      const segments = routeSegments();
      expect(segments).toHaveLength(2);
      expect(segments[1]).toHaveAttribute('title', '/ · 40.0s · 0:20.00 navigation');
    });
  });

  describe('services band', () => {
    /**
     * A session running 0s to 60s that started `count` traces, which is what the
     * band joins on. The frontend rows are what supply the trace ids, so a session
     * with no traces cannot have a band at all.
     */
    function mockSessionWithTraces(count: number) {
      mockEmptyDatasets(['spans']);
      mockDataset('spans', 'count', [
        {
          'count_unique(trace)': count,
          'min(precise.start_ts)': Date.parse('2024-01-01T00:00:00Z') / 1000,
          'max(precise.finish_ts)': Date.parse('2024-01-01T00:01:00Z') / 1000,
        },
      ]);
      mockDataset(
        'spans',
        'rows',
        Array.from({length: count}, (_, index) => ({
          id: `span${index}`,
          transaction: `/page-${index}`,
          'span.op': 'pageload',
          'span.duration': 100,
          // One arrival per second from the top of the session.
          timestamp: `2024-01-01T00:00:${String(index).padStart(2, '0')}+00:00`,
          trace: String(index).padStart(32, '0'),
          project: PROJECT.slug,
          'project.id': Number(PROJECT.id),
        }))
      );
    }

    /**
     * One server segment span, as the band's query returns them. The `id` is what
     * the bar is addressed by when it is clicked, so a fixture without one is
     * dropped from the band entirely.
     */
    function serverSpan({
      project,
      at,
      id = `server-${project}`,
      transaction = `GET /${project}`,
      duration = 1000,
      status = 'ok',
    }: {
      at: string;
      project: string;
      duration?: number;
      id?: string;
      status?: string;
      transaction?: string;
    }) {
      return {
        id,
        project,
        'project.id': Number(PROJECT.id),
        timestamp: at,
        transaction,
        'span.op': 'http.server',
        'span.duration': duration,
        'span.status': status,
        trace: '0'.repeat(32),
      };
    }

    it('draws one row per project, ordered by when the session reached it', async () => {
      mockSessionWithTraces(2);
      mockServices([
        serverSpan({
          project: 'payments-api',
          at: '2024-01-01T00:00:30+00:00',
        }),
        serverSpan({project: 'api-gateway', at: '2024-01-01T00:00:05+00:00'}),
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('Services reached')).toBeInTheDocument();
      expect(screen.getByText('api-gateway')).toBeInTheDocument();
      expect(screen.getByText('payments-api')).toBeInTheDocument();
      expect(screen.getAllByTestId('service-lane')).toHaveLength(2);

      // Ordered by first contact rather than alphabetically, so the band reads
      // top to bottom as the order things were called.
      const labels = screen
        .getAllByTestId('service-lane')
        .map(track => track.previousElementSibling?.textContent);
      expect(labels).toEqual(['api-gateway', 'payments-api']);
    });

    it('names the session own project with its bare slug', async () => {
      mockSessionWithTraces(1);
      mockServices([
        serverSpan({project: PROJECT.slug, at: '2024-01-01T00:00:10+00:00'}),
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      await screen.findByText('Services reached');

      // The Next.js case: a meta-framework ships both halves of the app to one
      // project. The row is still just that project — qualifying it as "the
      // backend" is a distinction the icon and the band's heading already make.
      const labels = screen
        .getAllByTestId('service-lane')
        .map(track => track.previousElementSibling?.textContent);
      expect(labels).toEqual([PROJECT.slug]);
    });

    it('marks only the stretch that failed, not the whole service row', async () => {
      mockSessionWithTraces(1);
      mockServices([
        serverSpan({
          id: 'ok-call',
          project: 'api-gateway',
          at: '2024-01-01T00:00:05+00:00',
        }),
        serverSpan({
          id: 'bad-call',
          project: 'api-gateway',
          at: '2024-01-01T00:00:20+00:00',
          status: 'internal_error',
        }),
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('api-gateway')).toBeInTheDocument();
      expect(screen.getAllByTestId('service-lane')).toHaveLength(1);

      // Severity is the one thing allowed to take colour in this band, and it
      // belongs to the call that failed. A service that answered one request and
      // dropped another is not a failing service, and a row painted red end to end
      // would say it was while hiding which call actually broke.
      const bars = screen.getAllByTestId('service-bar');
      expect(bars.map(bar => bar.getAttribute('data-failed'))).toEqual(['false', 'true']);
    });

    it('says the gap is unknown rather than empty when the trace cap skipped some', async () => {
      // Past the first-ten-plus-last-ten cap, so the middle of the session was
      // never queried.
      mockSessionWithTraces(24);
      mockServices([
        serverSpan({project: 'api-gateway', at: '2024-01-01T00:00:02+00:00'}),
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('Services reached')).toBeInTheDocument();
      expect(screen.getByText('4 traces not read')).toBeInTheDocument();

      await userEvent.hover(screen.getByText('*'));
      expect(
        await screen.findByText(
          'Built from the first and last 10 traces of this session. The 4 in between were never read, so the gap is unknown rather than empty.'
        )
      ).toBeInTheDocument();
    });

    it('draws no unloaded window when every trace fit inside the cap', async () => {
      mockSessionWithTraces(6);
      mockServices([
        serverSpan({project: 'api-gateway', at: '2024-01-01T00:00:02+00:00'}),
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('api-gateway')).toBeInTheDocument();
      expect(screen.queryByText(/traces not read/)).not.toBeInTheDocument();
      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('says so when the band failed to load rather than showing nothing', async () => {
      mockSessionWithTraces(1);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        method: 'GET',
        statusCode: 400,
        body: {detail: 'Invalid trace value.'},
        match: [(_url: string, options: Record<string, any>) => isServicesQuery(options)],
      });

      render(<SessionDetailView />, {organization, initialRouterConfig});

      // The heading stays: a band that broke and a session that called nothing
      // are different answers, and only the heading can tell them apart.
      expect(await screen.findByText('Services reached')).toBeInTheDocument();
      expect(screen.queryAllByTestId('service-lane')).toHaveLength(0);

      await userEvent.hover(screen.getByText('*'));
      expect(
        await screen.findByText(
          'Downstream services failed to load, so this band is missing.'
        )
      ).toBeInTheDocument();

      // And it stays a missing band, not a broken timeline.
      expect(
        screen.queryByText('Failed to load session telemetry.')
      ).not.toBeInTheDocument();
    });

    it('leaves the band out entirely when nothing downstream answered', async () => {
      mockSessionWithTraces(1);
      mockServices([]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      expect(await screen.findByText('/page-0')).toBeInTheDocument();

      // An empty labelled band would read as "the servers did nothing", which is
      // a claim a query that found no instrumented service cannot make.
      expect(screen.queryByText('Services reached')).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('service-lane')).toHaveLength(0);
    });

    it('opens the details panel for the span behind a service bar', async () => {
      mockSessionWithTraces(1);
      mockServices([
        serverSpan({
          project: 'report-worker',
          at: '2024-01-01T00:00:20+00:00',
          id: 'server-span-1',
          transaction: 'POST /api/report/generate',
        }),
      ]);

      // What the panel reads once a bar is selected: the span's own attributes,
      // and the trace its waterfall is built from.
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/${PROJECT.slug}/trace-items/server-span-1/`,
        method: 'GET',
        body: {
          itemId: 'server-span-1',
          timestamp: '',
          attributes: [],
          meta: {},
        },
      });
      const downstreamTrace = '0'.repeat(32);
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/events-trace/${downstreamTrace}/`,
        method: 'GET',
        body: {transactions: [], orphan_errors: []},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/events-trace-meta/${downstreamTrace}/`,
        method: 'GET',
        body: {
          errors: 0,
          performance_issues: 0,
          projects: 0,
          transactions: 0,
          transaction_child_count_map: [],
          span_count: 0,
          span_count_map: {},
        },
      });

      render(<SessionDetailView />, {organization, initialRouterConfig});
      await screen.findByText('report-worker');

      const track = trackWithGeometry();
      // A third of the way across a 60s session is 20s, which is where the span
      // starts; the bar runs a second from there.
      clickTrack(track, {clientX: 340, clientY: serviceY(0)});

      // The same panel a rail row opens: a server segment span is a trace item
      // reached from the other side of the request.
      expect(
        await screen.findByRole('button', {name: 'Open Full Trace'})
      ).toBeInTheDocument();
      expect(screen.getAllByText('POST /api/report/generate').length).toBeGreaterThan(0);
    });

    it('gives every service its project platform icon', async () => {
      ProjectsStore.loadInitialData([
        PROJECT,
        ProjectFixture({id: '77', slug: 'report-worker', platform: 'python'}),
      ]);
      mockSessionWithTraces(1);
      mockServices([
        serverSpan({
          project: 'report-worker',
          at: '2024-01-01T00:00:20+00:00',
        }),
      ]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      const label = (await screen.findByText('report-worker')).closest('div');
      expect(within(label!).getByTestId('platform-icon-python')).toBeInTheDocument();
    });

    it('joins on trace ids across every project, without a session filter', async () => {
      mockSessionWithTraces(2);
      const band = mockServices([]);

      render(<SessionDetailView />, {organization, initialRouterConfig});

      await screen.findByText('/page-0');

      expect(band).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            // Every project, because a trace can land in any of them. Permissions
            // are still applied server-side.
            project: [ALL_ACCESS_PROJECTS],
            query: expect.stringContaining(
              `trace:[${'0'.repeat(32)},${'1'.padStart(32, '0')}]`
            ),
          }),
        })
      );
      // No `session.id` term: backend SDKs never see one, and the trace id the
      // frontend does propagate is the whole join.
      expect(band.mock.calls[0][1].query.query).not.toContain('session.id');
    });
  });
});

/** Lane geometry from the scrubber: a 28px axis row over 40px lanes. */
const AXIS_HEIGHT = 28;
const LANE_HEIGHT = 40;
/** The route band, when there is one, inserts a 30px row under the axis. */
const ROUTE_HEIGHT = 30;
const ROUTE_Y = 42;
/** The services band: a 22px heading below the lanes, then 26px rows. */
const SERVICE_HEADER_HEIGHT = 22;
const SERVICE_HEIGHT = 26;

/**
 * The vertical centre of one service row, counted from the bottom of the lanes.
 *
 * Read off the drawn lane toggles for the same reason {@link laneY} is: how far
 * down the band starts depends on how many lanes the session drew.
 */
function serviceY(index: number) {
  const chart = screen.getByRole('group', {name: 'Session time window'}).parentElement!;
  const laneCount = chart.querySelectorAll('button[aria-pressed]').length;
  const routeOffset = screen.queryByText('Route') === null ? 0 : ROUTE_HEIGHT;
  return (
    AXIS_HEIGHT +
    routeOffset +
    laneCount * LANE_HEIGHT +
    SERVICE_HEADER_HEIGHT +
    index * SERVICE_HEIGHT +
    SERVICE_HEIGHT / 2
  );
}

/**
 * The vertical centre of one lane, read off what the chart actually drew rather
 * than from a table of offsets.
 *
 * A lane with nothing in it is left out, so a type's row depends on what else the
 * session holds — a logs-only session draws logs first, whatever the lane order
 * is. The toggles come out in draw order, so their index is the lane's.
 */
function laneY(label: string) {
  const chart = screen.getByRole('group', {name: 'Session time window'}).parentElement!;
  const toggles = Array.from(chart.querySelectorAll('button[aria-pressed]'));
  const index = toggles.findIndex(toggle => toggle.textContent?.startsWith(label));
  if (index === -1) {
    throw new Error(`No ${label} lane is drawn`);
  }
  const routeOffset = screen.queryByText('Route') === null ? 0 : ROUTE_HEIGHT;
  return AXIS_HEIGHT + routeOffset + index * LANE_HEIGHT + LANE_HEIGHT / 2;
}

/**
 * The scrubber's interactive track, given the size jsdom won't. Hit testing reads
 * the pointer's offset within this rect, so without it every click lands at the
 * session start.
 *
 * The overview strip is deliberately *not* inside this element, so the lane
 * offsets below are unaffected by it; reach for {@link overviewStrip} instead.
 */
function trackWithGeometry(width = 1000, height = 228) {
  return withGeometry(
    screen.getByRole('group', {name: 'Session time window'}),
    width,
    height
  );
}

/** The overview strip, which is pointer-only and so has no role to query by. */
function overviewStrip() {
  return screen.getByTestId('session-overview');
}

function withGeometry(element: HTMLElement, width = 1000, height = 20) {
  jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return element;
}

/**
 * One pointer event at one point, for the parts of a gesture that have to be read
 * between its steps rather than after it.
 */
function pointerTrack(track: HTMLElement, type: string, clientX: number) {
  act(() => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX,
      clientY: 10,
    });
    Object.defineProperty(event, 'pointerId', {value: 1});
    track.dispatchEvent(event);
  });
}

/**
 * A press and release at one point, which is a click rather than a drag.
 *
 * Built from `MouseEvent` because jsdom has no `PointerEvent` constructor; React
 * dispatches `onPointerDown` off the native event's type, and the coordinates the
 * handler reads come from the mouse init either way.
 */
function clickTrack(track: HTMLElement, at: {clientX: number; clientY: number}) {
  act(() => {
    for (const type of ['pointerdown', 'pointerup']) {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...at,
      });
      Object.defineProperty(event, 'pointerId', {value: 1});
      track.dispatchEvent(event);
    }
  });
}

/**
 * A press, a move and a release: a drag, which is what selects a range.
 *
 * One `act` per event, unlike {@link clickTrack}. The release reads the range the
 * move built out of state, so the move has to have been rendered by then — batched
 * together, the release still sees no drag at all.
 */
function dragTrack(track: HTMLElement, at: {clientY: number; from: number; to: number}) {
  for (const [type, clientX] of [
    ['pointerdown', at.from],
    ['pointermove', at.to],
    ['pointerup', at.to],
  ] as const) {
    act(() => {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX,
        clientY: at.clientY,
      });
      Object.defineProperty(event, 'pointerId', {value: 1});
      track.dispatchEvent(event);
    });
  }
}

/**
 * A wheel gesture over the lanes, and the event it dispatched — which is how the
 * page's own scroll is asserted on.
 *
 * Dispatched natively because the scrubber binds its own non-passive listener:
 * React's would be passive, where the `preventDefault` that keeps a zoom from also
 * scrolling the page is ignored.
 */
function wheelTrack(
  track: HTMLElement,
  at: {clientX: number; clientY: number; deltaY: number; shiftKey?: boolean}
) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ...at,
  });
  act(() => {
    track.dispatchEvent(event);
  });
  return event;
}
