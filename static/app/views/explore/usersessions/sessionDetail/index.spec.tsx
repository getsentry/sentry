import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';

import SessionDetailView from './index';

jest.mock('sentry/components/pageFilters/usePageFilters');

const SESSION_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TRACE = '1'.repeat(32);

function mockDataset(dataset: string, kind: 'count' | 'rows', data: unknown[]) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
    body: {data, meta: {fields: {}}},
    match: [
      (_url: string, options: Record<string, any>) =>
        options.query.dataset === dataset &&
        // The counts query asks for aggregates only; the rows query asks for the
        // bare `timestamp` field plus the per-dataset row fields.
        (kind === 'count'
          ? !options.query.field.includes('timestamp')
          : options.query.field.includes('timestamp')),
    ],
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
    MockApiClient.clearMockResponses();
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
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
    mockDataset('spans', 'count', [{'count()': 1}]);
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
        'span.description': 'GET /api/thing',
        'span.op': 'http.client',
        'span.duration': 250,
        timestamp: '2024-01-01T00:00:03+00:00',
        trace: TRACE,
        'transaction.span_id': 'fedcba9876543210',
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
    expect(screen.getByRole('button', {name: 'Spans 1'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Errors 1'})).toBeInTheDocument();

    // Ordered by timestamp descending across datasets. The span sits under a
    // trace row rather than on the rail itself.
    const items = railItems();
    expect(items).toHaveLength(4);
    expect(within(items[0]!).getByText('TypeError: boom')).toBeInTheDocument();
    expect(within(items[1]!).getByText(`Trace ${TRACE.slice(0, 8)}`)).toBeInTheDocument();
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

  it('places rows by their offset from the session start, and only spans carry a duration', async () => {
    mockEmptyDatasets(['logs', 'spans']);
    mockDataset('logs', 'count', [{'count()': 1}]);
    mockDataset('spans', 'count', [{'count()': 1}]);
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

  it('collapses a run of same-trace spans into one expandable trace row', async () => {
    const OTHER_TRACE = '2'.repeat(32);
    mockEmptyDatasets(['spans']);
    mockDataset('spans', 'count', [{'count()': 3}]);
    mockDataset('spans', 'rows', [
      {
        id: '1111111111111111',
        'span.description': 'first span',
        timestamp: '2024-01-01T00:00:01+00:00',
        trace: TRACE,
        'transaction.span_id': 'fedcba9876543210',
      },
      {
        id: '2222222222222222',
        'span.description': 'second span',
        timestamp: '2024-01-01T00:00:02+00:00',
        trace: TRACE,
      },
      {
        id: '3333333333333333',
        'span.description': 'span of another trace',
        timestamp: '2024-01-01T00:00:03+00:00',
        trace: OTHER_TRACE,
      },
    ]);

    render(<SessionDetailView />, {organization, initialRouterConfig});

    // Two traces, so two rows — the two spans of one trace share theirs.
    expect(
      await screen.findByText(`Trace ${OTHER_TRACE.slice(0, 8)}`)
    ).toBeInTheDocument();
    let items = railItems();
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('1 span')).toBeInTheDocument();
    expect(within(items[1]!).getByText('2 spans')).toBeInTheDocument();
    expect(screen.queryByText('second span')).not.toBeInTheDocument();

    // The trace row links to the waterfall, with no span preselected.
    const traceHref = within(items[1]!).getByRole('link').getAttribute('href')!;
    expect(traceHref).toContain(`/traces/trace/${TRACE}/`);
    expect(traceHref).not.toContain('node=');

    await userEvent.click(within(items[1]!).getByRole('button', {name: 'Expand trace'}));

    // Expanded: the spans appear under their trace, newest first, and each links
    // to itself.
    items = railItems();
    expect(items).toHaveLength(4);
    expect(within(items[2]!).getByText('second span')).toBeInTheDocument();
    expect(within(items[3]!).getByText('first span')).toBeInTheDocument();
    expect(within(items[2]!).getByText('Span')).toBeInTheDocument();
    expect(within(items[3]!).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('node=span-1111111111111111')
    );

    await userEvent.click(
      within(items[1]!).getByRole('button', {name: 'Collapse trace'})
    );
    expect(railItems()).toHaveLength(2);

    // The row is a wider target for that same button, so a near miss expands the
    // trace instead of navigating to it.
    await userEvent.click(within(railItems()[1]!).getByText('2 spans'));
    expect(railItems()).toHaveLength(4);
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

  it('links an error to the issue event, and a span to the trace waterfall with the span preselected', async () => {
    mockEmptyDatasets(['errors', 'spans']);
    mockDataset('errors', 'count', [{'count()': 1}]);
    mockDataset('spans', 'count', [{'count()': 1}]);
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

    // The span lives under its trace row, so reveal it first.
    await userEvent.click(screen.getByRole('button', {name: 'Expand trace'}));

    const spanHref = screen
      .getByRole('link', {name: /GET \/api\/thing/})
      .getAttribute('href')!;
    expect(spanHref).toContain(`/traces/trace/${TRACE}/`);
    // The span is preselected via the node path, with its transaction so the
    // waterfall expands down to it.
    expect(spanHref).toContain('node=span-abc123def4567890');
    expect(spanHref).toContain('node=txn-fedcba9876543210');
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

    expect(router.location.query.telemetryType).toEqual(['metrics', 'spans', 'errors']);
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
    mockDataset('spans', 'count', [{'count()': 1}]);
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
    mockDataset('spans', 'count', [{'count()': 2}]);

    // Spans are capped at 100 rows per request by the events endpoint, so the
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
    mockDataset('spans', 'count', [{'count()': 5000}]);

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
          options.query.dataset === 'spans' && options.query.field.includes('timestamp'),
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
});
