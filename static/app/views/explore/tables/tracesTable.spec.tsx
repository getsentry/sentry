import type {ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useExploreTracesTableApiOptions} from 'sentry/views/explore/hooks/useExploreTracesTable';
import type {TraceResult} from 'sentry/views/explore/hooks/useTraces';
import {useQueryParamsQuery} from 'sentry/views/explore/queryParams/context';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {TracesTable} from 'sentry/views/explore/tables/tracesTable';

jest.mock('sentry/utils/analytics');

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

function TracesTableWithResults() {
  const query = useQueryParamsQuery();
  const result = useQuery({
    ...useExploreTracesTableApiOptions({limit: 10, query}),
    select: selectJsonWithHeaders,
  });

  return <TracesTable tracesTableResult={{error: null, result}} />;
}

function makeTrace(overrides: Partial<TraceResult> = {}): TraceResult {
  return {
    breakdowns: [],
    duration: 100,
    end: 1_700_000_000_100,
    matchingSpans: 12,
    name: 'GET /api/0/projects/',
    numErrors: 0,
    numOccurrences: 0,
    numSpans: 30,
    project: 'project-slug',
    rootDuration: 100,
    slices: 40,
    start: 1_700_000_000_000,
    trace: 'a'.repeat(32),
    ...overrides,
  };
}

function makeSpan(id: string, description: string) {
  return {
    id,
    project: 'project-slug',
    'transaction.span_id': 'c'.repeat(16),
    timestamp: '2023-11-14T22:13:20+00:00',
    'span.op': 'db',
    'span.description': description,
    'span.duration': 12,
    'span.status': 'ok',
    'precise.start_ts': 1_700_000_000,
    'precise.finish_ts': 1_700_000_000.012,
  };
}

describe('TracesTable', () => {
  const {organization, project} = initializeOrg();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {period: '7d', start: null, end: null, utc: null},
    });
    jest.mocked(trackAnalytics).mockClear();
  });

  it('renders a row for each trace when traces are returned', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      body: {
        data: [
          makeTrace(),
          makeTrace({name: 'GET /api/0/issues/', numSpans: 45, trace: 'd'.repeat(32)}),
        ],
        meta: {},
      },
    });

    render(<TracesTableWithResults />, {
      organization,
      additionalWrapper: Wrapper,
    });

    expect(await screen.findByText('GET /api/0/projects/')).toBeInTheDocument();
    const table = screen.getByRole('table', {name: 'Trace samples'});
    expect(within(table).getByText('GET /api/0/issues/')).toBeInTheDocument();
    expect(
      within(table).getAllByRole('button', {name: 'Toggle trace details'})
    ).toHaveLength(2);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual([
      'Trace ID',
      'Trace Root',
      'Total Spans',
      'Timeline',
      'Root Duration',
      'Timestamp',
    ]);
    expect(within(table).getByRole('columnheader', {name: 'Timestamp'})).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    expect(within(table).getByText('30')).toBeInTheDocument();
    expect(within(table).getByText('45')).toBeInTheDocument();
  });

  it('shows the trace spans and tracks the toggle when a trace is expanded', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      body: {data: [makeTrace()], meta: {}},
    });
    const spansRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [makeSpan('b'.repeat(16), 'SELECT * FROM table')],
        meta: {},
      },
    });

    render(<TracesTableWithResults />, {
      organization,
      additionalWrapper: Wrapper,
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Toggle trace details'})
    );

    expect(await screen.findByText('SELECT * FROM table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Span ID'})).toBeInTheDocument();
    expect(screen.getByText(/more spans can be found in the trace/)).toHaveTextContent(
      '11 more spans can be found in the trace.'
    );
    expect(screen.getByRole('button', {name: 'Toggle trace details'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(spansRequest).toHaveBeenCalled();
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace_explorer.toggle_trace_details',
      expect.objectContaining({source: 'new explore'})
    );
  });

  it('expands the first trace and counts matching spans when a query is set', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      body: {
        data: [
          makeTrace(),
          makeTrace({name: 'GET /api/0/issues/', trace: 'd'.repeat(32)}),
        ],
        meta: {},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          makeSpan('b'.repeat(16), 'SELECT * FROM first'),
          makeSpan('e'.repeat(16), 'SELECT * FROM second'),
        ],
        meta: {},
      },
    });

    render(<TracesTableWithResults />, {
      organization,
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/traces/`,
          query: {query: 'span.op:db'},
        },
      },
    });

    expect(await screen.findByText('SELECT * FROM second')).toBeInTheDocument();
    const toggles = screen.getAllByRole('button', {name: 'Toggle trace details'});
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('columnheader', {name: 'Matching Spans'})
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('cell')
        .filter(cell => /^12\s+of\s+30$/.test(cell.textContent ?? ''))
    ).toHaveLength(2);
    expect(
      screen.getByRole('columnheader', {name: 'Span Breakdown'})
    ).toBeInTheDocument();
    expect(screen.getByText(/more matching spans can be found/)).toHaveTextContent(
      '10 more matching spans can be found in the trace.'
    );
  });

  it('shows the error indicator in the spans table when the spans request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      body: {data: [makeTrace()], meta: {}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      statusCode: 500,
      body: {},
    });

    render(<TracesTableWithResults />, {
      organization,
      additionalWrapper: Wrapper,
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Toggle trace details'})
    );

    const spansTable = await screen.findByRole('table', {name: 'Spans in trace'});
    expect(
      await within(spansTable).findByTestId('spans-error-indicator')
    ).toBeInTheDocument();
  });

  it('shows the empty state when no traces are returned', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      body: {data: [], meta: {}},
    });

    render(<TracesTableWithResults />, {
      organization,
      additionalWrapper: Wrapper,
    });

    expect(await screen.findByText('No trace results found')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'docs for search properties'})
    ).toBeInTheDocument();
  });

  it('shows the error indicator when the traces request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      statusCode: 500,
      body: {},
    });

    render(<TracesTableWithResults />, {
      organization,
      additionalWrapper: Wrapper,
    });

    expect(await screen.findByTestId('error-indicator')).toBeInTheDocument();
  });
});
