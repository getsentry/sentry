import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EventDetails} from 'sentry/views/issueDetails/streamline/eventDetails';
import {MOCK_EVENTS_TABLE_DATA} from 'sentry/views/performance/transactionSummary/transactionEvents/testUtils';

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

describe('EventDetails', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture();
  const event = EventFixture({id: 'event-id'});
  const committer = {
    author: {name: 'Butter the Dog', id: '2021'},
    commits: [
      {
        message: 'fix(training): Adjust noise level for meeting other dogs (#2024)',
        id: 'ab2709293d0c9000829084ac7b1c9221fb18437c',
        dateCreated: '2024-09-09T04:15:12',
        repository: RepositoryFixture(),
      },
    ],
  };
  const defaultProps = {project, group, event};
  let mockActionableItems, mockCommitters, mockTags, mockStats, mockList, mockListMeta;

  beforeEach(function () {
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
    mockActionableItems = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/actionable-items/`,
      body: {errors: []},
      method: 'GET',
    });
    mockCommitters = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {committers: [committer]},
      method: 'GET',
    });
    mockTags = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
      method: 'GET',
    });

    mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
      method: 'GET',
    });

    mockList = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link:
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",` +
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"`,
      },
      body: {
        data: MOCK_EVENTS_TABLE_DATA,
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('user.display');
        },
      ],
    });

    mockListMeta = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link:
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",` +
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"`,
      },
      body: {
        data: [{'count()': 100}],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('count()');
        },
      ],
    });
  });

  it('displays all basic components', async function () {
    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

    // Suspect Commits
    expect(mockCommitters).toHaveBeenCalled();
    expect(screen.getByText('Suspect Commit')).toBeInTheDocument();
    expect(screen.getByText(committer.author.name)).toBeInTheDocument();
    // Filtering
    expect(mockTags).toHaveBeenCalled();
    expect(screen.getByTestId('page-filter-environment-selector')).toBeInTheDocument();
    expect(screen.getByLabelText('Search events')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-timerange-selector')).toBeInTheDocument();
    // Graph
    expect(mockStats).toHaveBeenCalled();
    expect(screen.getByRole('figure')).toBeInTheDocument();
    // Navigation
    expect(screen.getByRole('tab', {name: 'Recommended Event'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'First Event'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next Event'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View All Events'})).toBeInTheDocument();
    // Content
    expect(mockActionableItems).toHaveBeenCalled();
    // All Events (should not query initially)
    expect(mockList).not.toHaveBeenCalled();
    expect(mockListMeta).not.toHaveBeenCalled();
  });

  it('allows toggling between event and list views', async function () {
    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

    const listButton = screen.getByRole('button', {name: 'View All Events'});
    await userEvent.click(listButton);

    expect(listButton).not.toBeInTheDocument();
    expect(screen.getByText('All Events')).toBeInTheDocument();
    expect(mockList).toHaveBeenCalled();
    expect(mockListMeta).toHaveBeenCalled();
    const closeButton = screen.getByRole('button', {name: 'Close'});
    await userEvent.click(closeButton);

    expect(closeButton).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View All Events'})).toBeInTheDocument();
  });

  it('displays error messages from bad queries', async function () {
    const errorMessage = 'wrong, try again';
    mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {detail: errorMessage},
      method: 'GET',
      statusCode: 400,
    });

    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

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

    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

    const search = screen.getAllByRole('combobox', {name: 'Add a search term'})[0];
    await userEvent.type(search, `${tagKey}:`);
    await userEvent.keyboard(`${tagValue}{enter}{enter}`);
    expect(mockUseNavigate).toHaveBeenCalledWith(expect.objectContaining(locationQuery), {
      replace: true,
    });
  });
});
