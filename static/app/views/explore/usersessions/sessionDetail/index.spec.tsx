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

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import {EntryType} from 'sentry/types/event';

import SessionDetailView from './index';

jest.mock('sentry/components/pageFilters/usePageFilters');

const SESSION_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TRACE = '1'.repeat(32);
const PROJECT = ProjectFixture();

/**
 * The route band's own query, which is a `spans` read like the trace rows are and
 * so has to be told apart from them. It is the only one narrowed by `span.op`.
 */
function isRouteQuery(options: Record<string, any>) {
  return String(options.query.query).includes('span.op:[');
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
        options.query.field.includes('timestamp') &&
        options.query.cursor === cursor,
    ],
  });
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
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([PROJECT]);
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
    // Mocks are matched most-recently-registered first, so a test about the band
    // overrides this by calling `mockRouteVisits` itself.
    mockRouteVisits([]);
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
      {id: 'log1', message: 'first log', timestamp: '2024-01-01T00:00:01+00:00'},
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

    // The total sits on the identity row; the breakdown is on the lanes it
    // describes, one exact count per telemetry type.
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
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
      {id: 'log1', message: 'first log', timestamp: '2024-01-01T00:00:00+00:00'},
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
      {id: 'log1', message: 'before the gap', timestamp: '2024-01-01T00:00:00+00:00'},
      {id: 'log2', message: 'after the gap', timestamp: '2024-01-01T00:01:00+00:00'},
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

    // Rows link to the whole trace, not to the span that named it.
    const href = within(items[1]!).getByRole('link').getAttribute('href')!;
    expect(href).toContain(`/traces/trace/${TRACE}/`);
    expect(href).not.toContain('node=');

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
      {id: 'log1', message: 'first log', timestamp: '2024-01-01T00:00:01+00:00'},
      {id: 'log2', message: 'second log', timestamp: '2024-01-01T00:00:02+00:00'},
    ]);

    const {router} = render(<SessionDetailView />, {organization, initialRouterConfig});

    // Default: newest first, without needing a sort param in the URL.
    expect(await screen.findByText('second log')).toBeInTheDocument();
    expect(rowsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({query: expect.objectContaining({sort: '-timestamp'})})
    );
    expect(within(railItems()[0]!).getByText('second log')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Oldest first'}));

    expect(router.location.query.sort).toBe('timestamp');
    expect(rowsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({query: expect.objectContaining({sort: 'timestamp'})})
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
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    const errorLink = await screen.findByRole('link', {name: /TypeError: boom/});
    expect(errorLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/99/events/deadbeefdeadbeefdeadbeefdeadbeef/'
    );

    const traceHref = screen
      .getByRole('link', {name: /GET \/api\/thing/})
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

    const href = (await screen.findByRole('link', {name: /first log/})).getAttribute(
      'href'
    )!;
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

    const href = (
      await screen.findByRole('link', {name: /checkout.latency/})
    ).getAttribute('href')!;
    expect(href).toContain(`/traces/trace/${TRACE}/`);
    expect(href).toContain('tab=metrics');
  });

  it('hides a telemetry type from the scrubber lane it is labelled by', async () => {
    mockEmptyDatasets(['logs', 'errors']);
    mockDataset('logs', 'count', [{'count()': 1}]);
    mockDataset('errors', 'count', [{'count()': 1}]);
    mockDataset('logs', 'rows', [
      {id: 'log1', message: 'first log', timestamp: '2024-01-01T00:00:01+00:00'},
    ]);
    mockDataset('errors', 'rows', [
      {
        id: 'deadbeefdeadbeefdeadbeefdeadbeef',
        'issue.id': 99,
        title: 'TypeError: boom',
        timestamp: '2024-01-01T00:00:02+00:00',
      },
    ]);

    const {router} = render(<SessionDetailView />, {organization, initialRouterConfig});

    // Every type is on by default, with no param in the URL.
    expect(await screen.findByText('first log')).toBeInTheDocument();
    expect(screen.getByText('TypeError: boom')).toBeInTheDocument();

    const logsLane = screen.getByRole('button', {name: 'Logs 1', pressed: true});
    await userEvent.click(logsLane);

    expect(router.location.query.telemetryType).toEqual(['metrics', 'traces', 'errors']);
    expect(screen.queryByText('first log')).not.toBeInTheDocument();
    expect(screen.getByText('TypeError: boom')).toBeInTheDocument();

    // The counts stay exact, whatever the rail shows — a hidden type's lane label
    // still reports what the session holds.
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
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
      {'count()': 2, 'min(timestamp)': undefined, 'max(timestamp)': undefined},
    ]);
    mockDataset('logs', 'rows', [
      {id: 'log1', message: 'early log', timestamp: '2024-01-01T00:00:00+00:00'},
      {id: 'log2', message: 'late log', timestamp: '2024-01-01T00:01:00+00:00'},
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
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Reset zoom'}));
    expect(await screen.findByText('early log')).toBeInTheDocument();
    expect(screen.getByText('late log')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Logs 2'})).toBeInTheDocument();
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
      {id: 'log1', message: 'the only row', timestamp: '2024-01-01T00:01:00+00:00'},
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
        body: {itemId: id, timestamp: '2024-01-01T00:00:01+00:00', attributes, meta: {}},
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
          location: {...initialRouterConfig.location, query: {item: 'logs:log1'}},
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
          location: {...initialRouterConfig.location, query: {item: 'logs:log1'}},
        },
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Close Drawer'}));
      await waitFor(() => {
        expect(router.location.query.item).toBeUndefined();
      });
    });

    it("leaves the row's own deep link alone", async () => {
      mockOneLog();

      const {router} = render(<SessionDetailView />, {
        organization,
        initialRouterConfig,
      });

      // Selecting the row is the row's job; the title is still a link out to the
      // tool that owns the item.
      await userEvent.click(await screen.findByText('first log'));

      await waitFor(() => {
        expect(router.location.pathname).toBe('/organizations/org-slug/explore/logs/');
      });
      expect(router.location.query.item).toBeUndefined();
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

      // The session spans 1s to 3s over 1000px, so the middle log sits at 500px,
      // and the logs lane is the third of four.
      clickTrack(track, {clientX: 500, clientY: LANE_Y.logs});

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

    it('still resets the window when empty lane space is clicked', async () => {
      mockEmptyDatasets(['logs']);
      mockDataset('logs', 'count', [{'count()': 2}]);
      mockDataset('logs', 'rows', [
        {id: 'log1', message: 'early log', timestamp: '2024-01-01T00:00:00+00:00'},
        {id: 'log2', message: 'late log', timestamp: '2024-01-01T00:01:00+00:00'},
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
      // so the click means what it always meant.
      clickTrack(track, {clientX: 500, clientY: LANE_Y.logs});

      expect(await screen.findByText('early log')).toBeInTheDocument();
      expect(screen.getByText('late log')).toBeInTheDocument();
      expect(router.location.query.item).toBeUndefined();
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
      clickTrack(track, {clientX: 250, clientY: LANE_Y.traces});

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
          location: {...initialRouterConfig.location, query: {item: 'logs:log1'}},
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
      expect(segments[0]).toHaveStyle({left: '0%', width: '33.33333333333333%'});
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
        {id: 'log1', message: 'on the home page', timestamp: '2024-01-01T00:00:05+00:00'},
        {id: 'log2', message: 'in the cart', timestamp: '2024-01-01T00:00:40+00:00'},
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
      clickTrack(trackWithGeometry(1000, 218), {clientX: 100, clientY: ROUTE_Y});

      await waitFor(() => {
        expect(screen.queryByText('in the cart')).not.toBeInTheDocument();
      });
      expect(screen.getByText('on the home page')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Reset zoom'})).toBeInTheDocument();

      // And the lanes below have moved down by the band's row, so a click still
      // finds the item it is pointed at rather than the lane above it.
      clickTrack(trackWithGeometry(1000, 218), {
        clientX: 83,
        clientY: ROUTED_LANE_Y.logs,
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
        {id: 'log1', message: 'a backend log', timestamp: '2024-01-01T00:00:00+00:00'},
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
});

/** Lane geometry from the scrubber: a 28px axis row over four 40px lanes. */
const LANE_Y = {errors: 48, traces: 88, logs: 128, metrics: 168};

/**
 * The same geometry with the route band present, which inserts a 30px row under
 * the axis and pushes every lane down by it.
 */
const ROUTE_Y = 42;
const ROUTED_LANE_Y = {errors: 78, traces: 118, logs: 158, metrics: 198};

/**
 * The scrubber's interactive track, given the size jsdom won't. Hit testing reads
 * the pointer's offset within this rect, so without it every click lands at the
 * session start.
 */
function trackWithGeometry(width = 1000, height = 188) {
  const track = screen.getByRole('group', {name: 'Session time window'});
  jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({
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
  return track;
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
