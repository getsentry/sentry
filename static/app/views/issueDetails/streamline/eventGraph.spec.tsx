import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import {EventDetails} from 'sentry/views/issueDetails/streamline/eventDetails';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/components/events/suspectCommits');
jest.mock('sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent');
jest.mock('sentry/views/issueDetails/streamline/issueContent');
jest.mock('screenfull', () => ({
  enabled: true,
  isFullscreen: false,
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

const mockUseNavigate = jest.fn();
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => mockUseNavigate,
}));

const mockUseLocation = jest.mocked(useLocation);

describe('EventGraph', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    environments: ['production', 'staging', 'development'],
  });
  const group = GroupFixture();
  const event = EventFixture({id: 'event-id'});
  const persistantQuery = ` issue:${group.shortId}`;
  const defaultProps = {project, group, event};

  let mockEventStats;

  beforeEach(() => {
    mockUseLocation.mockReturnValue(LocationFixture());
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
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/actionable-items/`,
      body: {errors: []},
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
      method: 'GET',
    });
    mockEventStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
      method: 'GET',
    });
  });

  it('displays allows toggling data sets', async function () {
    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

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
    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);
    expect(mockEventStats).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: {
          dataset: 'errors',
          environment: [],
          interval: '12h',
          project: Number(project.id),
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
    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

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

  it('allows filtering by search token', async function () {
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

    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

    const search = screen.getAllByRole('combobox', {name: 'Add a search term'})[0];
    await userEvent.type(search, `${tagKey}:`);
    await userEvent.keyboard(`${tagValue}{enter}{enter}`);
    expect(mockUseNavigate).toHaveBeenCalledWith(expect.objectContaining(locationQuery), {
      replace: true,
    });
  });

  it('updates query from location param change', async function () {
    const [tagKey, tagValue] = ['user.email', 'leander.rodrigues@sentry.io'];
    const locationQuery = {
      query: {
        query: `${tagKey}:${tagValue}`,
      },
    };
    mockUseLocation.mockReset();
    mockUseLocation.mockReturnValue(LocationFixture(locationQuery));
    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

    expect(mockEventStats).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: locationQuery.query.query + persistantQuery,
        }),
      })
    );
  });

  it('allows filtering by date', async function () {
    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

    await userEvent.click(screen.getByRole('button', {name: '14D'}));
    await userEvent.click(screen.getByRole('option', {name: 'Last 7 days'}));

    expect(mockEventStats).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '7d',
        }),
      })
    );
  });
});
