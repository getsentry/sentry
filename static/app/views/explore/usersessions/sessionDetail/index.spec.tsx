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
        // The counts query asks for a single aggregate field; the rows query
        // asks for `timestamp` plus the per-dataset row fields.
        (kind === 'count'
          ? !options.query.field.includes('timestamp')
          : options.query.field.includes('timestamp')),
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

  it('shows per-dataset counts and a merged timeline, newest first', async () => {
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

    // Counts: total is the sum of the four.
    expect(screen.getByText('Telemetry')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();

    // Timeline is ordered by timestamp descending across datasets. The span sits
    // under a trace row rather than on the timeline itself.
    const rows = screen.getAllByRole('row');
    const bodyRows = rows.slice(1);
    expect(bodyRows).toHaveLength(4);
    expect(within(bodyRows[0]!).getByText('TypeError: boom')).toBeInTheDocument();
    expect(
      within(bodyRows[1]!).getByText(`Trace ${TRACE.slice(0, 8)}`)
    ).toBeInTheDocument();
    expect(within(bodyRows[2]!).getByText('checkout.latency')).toBeInTheDocument();
    expect(within(bodyRows[3]!).getByText('first log')).toBeInTheDocument();

    // The Type tag labels one item, so it is singular — while the count tiles
    // above stay plural.
    expect(within(bodyRows[0]!).getByText('Error')).toBeInTheDocument();
    expect(within(bodyRows[1]!).getByText('Trace')).toBeInTheDocument();
    expect(within(bodyRows[2]!).getByText('Metric')).toBeInTheDocument();
    expect(within(bodyRows[3]!).getByText('Log')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
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
    let bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[0]!).getByText('1 span')).toBeInTheDocument();
    expect(within(bodyRows[1]!).getByText('2 spans')).toBeInTheDocument();
    expect(screen.queryByText('second span')).not.toBeInTheDocument();

    // The trace row links to the waterfall, with no span preselected.
    const traceLink = within(bodyRows[1]!).getByRole('link');
    const traceHref = traceLink.getAttribute('href')!;
    expect(traceHref).toContain(`/traces/trace/${TRACE}/`);
    expect(traceHref).not.toContain('node=');

    await userEvent.click(
      within(bodyRows[1]!).getByRole('button', {name: 'Expand trace'})
    );

    // Expanded: the spans appear under their trace, newest first, and each links
    // to itself.
    bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(4);
    expect(within(bodyRows[2]!).getByText('second span')).toBeInTheDocument();
    expect(within(bodyRows[3]!).getByText('first span')).toBeInTheDocument();
    expect(within(bodyRows[2]!).getByText('Span')).toBeInTheDocument();
    expect(within(bodyRows[3]!).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('node=span-1111111111111111')
    );

    await userEvent.click(
      within(bodyRows[1]!).getByRole('button', {name: 'Collapse trace'})
    );
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(2);
  });

  it('toggles the timeline sort from the Timestamp header, and asks the API for that order', async () => {
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
    let bodyRows = screen.getAllByRole('row').slice(1);
    expect(within(bodyRows[0]!).getByText('second log')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Timestamp'}));

    expect(router.location.query.sort).toBe('timestamp');
    expect(rowsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({sort: 'timestamp'}),
      })
    );
    await waitFor(() => {
      bodyRows = screen.getAllByRole('row').slice(1);
      expect(within(bodyRows[0]!).getByText('first log')).toBeInTheDocument();
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

    const errorLink = await screen.findByRole('link', {
      name: /TypeError: boom/,
    });
    expect(errorLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/99/events/deadbeefdeadbeefdeadbeefdeadbeef/'
    );

    // The span lives under its trace row, so reveal it first.
    await userEvent.click(screen.getByRole('button', {name: 'Expand trace'}));

    const spanLink = screen.getByRole('link', {name: /GET \/api\/thing/});
    const spanHref = spanLink.getAttribute('href')!;
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

    const link = await screen.findByRole('link', {name: /first log/});
    const href = link.getAttribute('href')!;
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

    const link = await screen.findByRole('link', {name: /checkout.latency/});
    const href = link.getAttribute('href')!;
    expect(href).toContain(`/traces/trace/${TRACE}/`);
    expect(href).toContain('tab=metrics');
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
});
