import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EventGraph} from 'sentry/views/issueDetails/streamline/eventGraph';

import {EventDetailsHeader} from './eventDetailsHeader';

describe('EventGraph', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    environments: ['production', 'staging', 'development'],
  });
  const group = GroupFixture();
  const event = EventFixture({id: 'event-id'});
  const persistantQuery = `issue:${group.shortId}`;
  const defaultProps = {group, event, project, showReleasesAs: 'bubble' as const};

  let mockEventStats: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: [project],
    });
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });
    ProjectsStore.loadInitialData([project]);
    mockEventStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [{'count_unique(user)': 21}]},
    });
  });

  it('displays allows toggling data sets', async () => {
    render(<EventDetailsHeader {...defaultProps} />, {
      organization,

      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/group-id/',
          query: {statsPeriod: '14d'},
        },
      },
    });
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();

    const eventsToggle = screen.getByRole('button', {
      name: 'Toggle graph series - Events',
    });
    const usersToggle = screen.getByRole('button', {name: 'Toggle graph series - Users'});

    expect(eventsToggle).toHaveTextContent('444');
    expect(usersToggle).toHaveTextContent('21');

    // Defaults to events graph
    expect(eventsToggle).toBeDisabled();
    expect(usersToggle).toBeEnabled();

    // Switch to users graph
    await userEvent.click(usersToggle);
    expect(eventsToggle).toBeEnabled();
    expect(usersToggle).toBeDisabled();

    // Another click should do nothing
    await userEvent.click(usersToggle);
    expect(eventsToggle).toBeEnabled();
    expect(usersToggle).toBeDisabled();

    // Switch back to events
    await userEvent.click(eventsToggle);
    expect(eventsToggle).toBeDisabled();
    expect(usersToggle).toBeEnabled();
  });

  it('renders the graph using a discover event stats query', async () => {
    render(<EventGraph {...defaultProps} />, {
      organization,

      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/group-id/',
          query: {statsPeriod: '14d'},
        },
      },
    });
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();

    expect(mockEventStats).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: {
          dataset: 'errors',
          environment: [],
          field: expect.anything(),
          partial: 1,
          interval: '4h',
          per_page: 50,
          project: [project.id],
          query: persistantQuery,
          referrer: 'issue_details.streamline_graph',
          statsPeriod: '14d',
          yAxis: ['count()', 'count_unique(user)'],
        },
      })
    );
  });

  it('allows filtering by environment, and shows unfiltered stats', async () => {
    render(<EventDetailsHeader {...defaultProps} />, {
      organization,

      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/group-id/',
          query: {statsPeriod: '14d'},
        },
      },
    });
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'All Envs'}));
    await waitFor(() => {
      expect(mockEventStats).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            environment: [],
          }),
        })
      );
    });

    await userEvent.click(screen.getByRole('row', {name: 'production'}));

    // Also makes request without environment filter
    await waitFor(() => {
      expect(mockEventStats).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            environment: ['production'],
          }),
        })
      );
    });
  });

  it('updates query from location param change', async () => {
    const [tagKey, tagValue] = ['user.email', 'leander.rodrigues@sentry.io'];
    const query = `${tagKey}:${tagValue}`;

    render(<EventDetailsHeader {...defaultProps} />, {
      organization,

      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/group-id/',
          query: {statsPeriod: '14d', query},
        },
      },
    });
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();

    expect(mockEventStats).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: [persistantQuery, query].join(' '),
        }),
      })
    );
    // Also makes request without tag filter
    expect(mockEventStats).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: persistantQuery,
        }),
      })
    );
  });

  it('allows filtering by date', async () => {
    render(<EventDetailsHeader {...defaultProps} />, {
      organization,

      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/group-id/',
          query: {statsPeriod: '14d'},
        },
      },
    });
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: '14D'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Last 7 days'}));

    expect(mockEventStats).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('displays error messages from bad queries', async () => {
    const errorMessage = 'wrong, try again';
    const mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {detail: errorMessage},
      method: 'GET',
      statusCode: 400,
    });

    render(<EventDetailsHeader {...defaultProps} />, {
      organization,

      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/group-id/',
          query: {statsPeriod: '14d'},
        },
      },
    });
    await screen.findByRole('button', {name: '14D'});

    expect(mockStats).toHaveBeenCalled();
    expect(screen.getByText(new RegExp(errorMessage))).toBeInTheDocument();
    // Omit the graph
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });
});
