import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';

import {EventDetailsHeader} from './eventDetailsHeader';

const mockUseNavigate = jest.fn();
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => mockUseNavigate,
}));

describe('EventDetailsHeader', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    environments: ['production', 'staging', 'development'],
  });
  const group = GroupFixture();
  const event = EventFixture({id: 'event-id'});
  const persistantQuery = `issue:${group.shortId}`;
  const defaultProps = {group, event};

  let mockEventStats: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
      method: 'GET',
    });
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      new Set(['environments'])
    );
    ProjectsStore.loadInitialData([project]);
    mockEventStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
      method: 'GET',
    });
  });

  it('displays allows toggling data sets', async function () {
    render(<EventDetailsHeader {...defaultProps} />, {organization});
    await screen.findByRole('button', {name: 'Events 444'});

    const count = EventsStatsFixture().data.reduce(
      (currentCount, item) => currentCount + item[1][0].count,
      0
    );

    const eventsToggle = screen.getByRole('button', {name: `Events ${count}`});
    const usersToggle = screen.getByRole('button', {name: `Users ${count}`});

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

  it('renders the graph using a discover event stats query', async function () {
    render(<EventDetailsHeader {...defaultProps} />, {organization});
    await screen.findByRole('button', {name: 'Events 444'});
    expect(mockEventStats).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: {
          dataset: 'errors',
          environment: [],
          field: expect.anything(),
          partial: 1,
          interval: '12h',
          per_page: 50,
          project: [project.id],
          query: persistantQuery,
          referrer: 'issue_details.streamline_graph',
          statsPeriod: '14d',
          yAxis: ['count()', 'count_unique(user)'],
        },
      })
    );

    expect(screen.queryByLabelText('Open in Discover')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('figure'));
    const discoverButton = screen.getByLabelText('Open in Discover');
    expect(discoverButton).toBeInTheDocument();
    expect(discoverButton).toHaveAttribute(
      'href',
      expect.stringContaining(`/organizations/${organization.slug}/discover/results/`)
    );
  });

  it('allows filtering by environment', async function () {
    render(<EventDetailsHeader {...defaultProps} />, {organization});
    await screen.findByRole('button', {name: 'Events 444'});

    await userEvent.click(screen.getByRole('button', {name: 'All Envs'}));
    await userEvent.click(screen.getByRole('row', {name: 'production'}));

    expect(mockEventStats).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['production'],
        }),
      })
    );
  });

  it('updates query from location param change', async function () {
    const [tagKey, tagValue] = ['user.email', 'leander.rodrigues@sentry.io'];
    const locationQuery = {
      query: {
        query: `${tagKey}:${tagValue}`,
      },
    };
    const router = RouterFixture({
      location: LocationFixture(locationQuery),
    });
    render(<EventDetailsHeader {...defaultProps} />, {organization, router});
    await screen.findByRole('button', {name: 'Events 444'});

    expect(mockEventStats).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: [persistantQuery, locationQuery.query.query].join(' '),
        }),
      })
    );
  });

  it('allows filtering by date', async function () {
    render(<EventDetailsHeader {...defaultProps} />, {organization});
    await screen.findByRole('button', {name: 'Events 444'});

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

  it('displays error messages from bad queries', async function () {
    const errorMessage = 'wrong, try again';
    const mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {detail: errorMessage},
      method: 'GET',
      statusCode: 400,
    });

    render(<EventDetailsHeader {...defaultProps} />, {organization});
    await screen.findByRole('button', {name: '14D'});

    expect(mockStats).toHaveBeenCalled();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    // Omit the graph
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });

  it('updates the query params with search tokens', async function () {
    const [tagKey, tagValue] = ['user.email', 'leander.rodrigues@sentry.io'];
    const locationQuery = {
      query: {
        query: `${tagKey}:${tagValue}`,
      },
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/${tagKey}/values/`,
      body: [
        {
          key: tagKey,
          name: tagValue,
          value: tagValue,
        },
      ],
      method: 'GET',
    });

    render(<EventDetailsHeader {...defaultProps} />, {organization});
    await screen.findByRole('button', {name: 'Events 444'});

    const search = screen.getAllByRole('combobox', {name: 'Add a search term'})[0];
    await userEvent.type(search, `${tagKey}:`);
    await userEvent.keyboard(`${tagValue}{enter}{enter}`);
    expect(mockUseNavigate).toHaveBeenCalledWith(expect.objectContaining(locationQuery), {
      replace: true,
    });
  });
});
