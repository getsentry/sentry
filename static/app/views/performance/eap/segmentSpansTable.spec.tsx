import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {SegmentSpansTable} from 'sentry/views/performance/eap/segmentSpansTable';

describe('SegmentSpansTable', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: '1'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({projects: [Number(project.id)]})
    );
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('renders column headers and data rows', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            span_id: 'abc123def456',
            'user.email': 'test@example.com',
            'user.username': '',
            'user.id': '',
            'user.ip': '',
            'span.duration': 250,
            trace: 'trace-abc123',
            timestamp: '2025-01-01T00:00:00+00:00',
            replayId: '',
            'profile.id': '',
            'profiler.id': '',
            'thread.id': '',
            'precise.start_ts': 1735689600,
            'precise.finish_ts': 1735689600.25,
          },
        ],
        meta: {
          fields: {
            span_id: 'string',
            'user.email': 'string',
            'user.username': 'string',
            'user.id': 'string',
            'user.ip': 'string',
            'span.duration': 'duration',
            trace: 'string',
            timestamp: 'date',
            replayId: 'string',
            'profile.id': 'string',
            'profiler.id': 'string',
            'thread.id': 'string',
            'precise.start_ts': 'number',
            'precise.finish_ts': 'number',
          },
          units: {'span.duration': 'millisecond'},
        },
      },
    });

    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: 'test',
        fields: ['span_id', 'span.duration', 'trace', 'timestamp'],
        projects: [Number(project.id)],
        query: '',
        orderby: '-span.duration',
      },
      {
        pathname: '/performance/summary/',
        query: {transaction: '/api/test', project: project.id},
        search: '',
        hash: '',
        state: undefined,
        action: 'POP',
        key: '',
      }
    );

    render(
      <SegmentSpansTable
        eventView={eventView}
        handleDropdownChange={jest.fn()}
        totalValues={{'p95()': 500}}
        transactionName="/api/test"
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/performance/summary/',
            query: {transaction: '/api/test', project: project.id},
          },
        },
      }
    );

    // Verify column headers
    expect(await screen.findByText('Trace ID')).toBeInTheDocument();
    expect(screen.getByText('Span ID')).toBeInTheDocument();
    expect(screen.getByText('Total Duration')).toBeInTheDocument();
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('Replay')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();

    // Verify the Filter dropdown trigger is present
    expect(screen.getByText('Filter')).toBeInTheDocument();

    // Verify data from the mock response appears
    expect(await screen.findByText('abc123def456')).toBeInTheDocument();
  });
});
