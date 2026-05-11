import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {EventView} from 'sentry/utils/discover/eventView';
import {SampledEventsTable} from 'sentry/views/performance/transactionSummary/transactionEvents/eapSampledEventsTable';

describe('EAP SampledEventsTable', () => {
  const project = ProjectFixture({id: '1', platform: 'javascript'});
  const organization = OrganizationFixture({
    features: ['performance-view'],
  });

  const META_FIELDS = {
    span_id: 'string',
    'user.id': 'string',
    'user.email': 'string',
    'user.username': 'string',
    'user.ip': 'string',
    'span.duration': 'duration',
    trace: 'string',
    timestamp: 'date',
    'profile.id': 'string',
    'profiler.id': 'string',
    'thread.id': 'number',
    'precise.start_ts': 'number',
    'precise.finish_ts': 'number',
    'spans.browser': 'number',
    'spans.db': 'number',
    'spans.http': 'number',
    'spans.resource': 'number',
    'spans.ui': 'number',
    'transaction.event_id': 'string',
    'transaction.span_id': 'string',
    project: 'string',
  };

  function addDataMock(row: Record<string, unknown>) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {fields: META_FIELDS},
        data: [row],
      },
      match: [
        (_url, options) =>
          options.query?.field?.includes('span_id') &&
          options.query?.query?.includes('transaction:/api/test') &&
          options.query?.query?.includes('is_transaction:true'),
      ],
    });
  }

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: 'test',
      fields: ['span_id', 'span.duration', 'trace', 'timestamp'],
      query: '',
      projects: [Number(project.id)],
      orderby: '-timestamp',
    },
    LocationFixture({pathname: '/'})
  );

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({projects: [Number(project.id)]})
    );

    // Count query
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {fields: {'count()': 'integer'}},
        data: [{'count()': 3}],
      },
      match: [(_url, options) => options.query?.field?.includes('count()')],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders the table with data', async () => {
    addDataMock({
      span_id: 'abc123',
      'user.id': '',
      'user.email': 'user@example.com',
      'user.username': '',
      'user.ip': '',
      'span.duration': 350,
      trace: 'trace123',
      timestamp: '2025-01-01T12:00:00+00:00',
      'profile.id': 'prof1',
      'profiler.id': '',
      'thread.id': 0,
      'precise.start_ts': 123,
      'precise.finish_ts': 124,
      'spans.browser': 50,
      'spans.db': 100,
      'spans.http': 150,
      'spans.resource': 50,
      'spans.ui': 0,
      'transaction.event_id': 'event_id_123',
      'transaction.span_id': 'span_id_123',
      project: project.slug,
    });

    render(
      <SampledEventsTable
        eventView={eventView}
        transactionName="/api/test"
        maxDuration={5000}
        isMaxDurationLoading={false}
        cursor={undefined}
        onCursor={() => {}}
      />,
      {organization}
    );

    // Wait for the table to render with data
    expect(await screen.findByText('user@example.com')).toBeInTheDocument();

    // Verify key column headers are present
    expect(screen.getByText('Span ID')).toBeInTheDocument();
    expect(screen.getByText('Total Duration')).toBeInTheDocument();
    expect(screen.getByText('Trace ID')).toBeInTheDocument();
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('Operation Duration')).toBeInTheDocument();

    // Verify ops breakdown renders
    expect(screen.getByTestId('relative-ops-breakdown')).toBeInTheDocument();

    // Verify V1 (transaction) profile link
    const profileLink = screen.getByRole('button', {name: 'View Profile'});
    expect(profileLink).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/profiling/profile/${project.slug}/prof1/flamegraph/?referrer=performance`
    );
  });

  it('links to the continuous profile when a profiler id is present', async () => {
    // thread.id === 0 is a valid main-thread identifier and must not disable
    // the profile link.
    addDataMock({
      span_id: 'abc123',
      'user.id': '',
      'user.email': 'user@example.com',
      'user.username': '',
      'user.ip': '',
      'span.duration': 350,
      trace: 'trace123',
      timestamp: '2025-01-01T12:00:00+00:00',
      'profile.id': '',
      'profiler.id': 'profiler_xyz',
      'thread.id': 0,
      'precise.start_ts': 1735732800,
      'precise.finish_ts': 1735732801,
      'spans.browser': 50,
      'spans.db': 100,
      'spans.http': 150,
      'spans.resource': 50,
      'spans.ui': 0,
      'transaction.event_id': 'event_id_123',
      'transaction.span_id': 'span_id_123',
      project: project.slug,
    });

    render(
      <SampledEventsTable
        eventView={eventView}
        transactionName="/api/test"
        maxDuration={5000}
        isMaxDurationLoading={false}
        cursor={undefined}
        onCursor={() => {}}
      />,
      {organization}
    );

    // Verify V2 (continuous) profile link
    const profileLink = await screen.findByRole('button', {name: 'View Profile'});
    const href = profileLink.getAttribute('href') ?? '';
    expect(href).toContain(
      `/organizations/${organization.slug}/explore/profiling/profile/${project.slug}/flamegraph/`
    );
    expect(href).toContain('profilerId=profiler_xyz');
    expect(href).toContain('tid=0');
    expect(href).toContain('eventId=event_id_123');
    expect(href).toContain('traceId=trace123');
    expect(href).toContain('transactionId=span_id_123');
    expect(href).toContain('referrer=performance');
  });
});
