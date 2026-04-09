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

    // Main data query
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {
          fields: {
            span_id: 'string',
            'user.id': 'string',
            'user.email': 'string',
            'user.username': 'string',
            'user.ip': 'string',
            'span.duration': 'duration',
            trace: 'string',
            timestamp: 'date',
            'profile.id': 'string',
            'spans.browser': 'number',
            'spans.db': 'number',
            'spans.http': 'number',
            'spans.resource': 'number',
            'spans.ui': 'number',
          },
        },
        data: [
          {
            span_id: 'abc123',
            'user.id': '',
            'user.email': 'user@example.com',
            'user.username': '',
            'user.ip': '',
            'span.duration': 350,
            trace: 'trace123',
            timestamp: '2025-01-01T12:00:00+00:00',
            'profile.id': 'prof1',
            'spans.browser': 50,
            'spans.db': 100,
            'spans.http': 150,
            'spans.resource': 50,
            'spans.ui': 0,
          },
        ],
      },
      match: [
        (_url, options) =>
          options.query?.field?.includes('span_id') &&
          options.query?.query?.includes('transaction:/api/test') &&
          options.query?.query?.includes('is_transaction:true'),
      ],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders the table with data', async () => {
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
  });
});
