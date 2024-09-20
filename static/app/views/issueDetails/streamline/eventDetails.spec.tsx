import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EventDetails} from 'sentry/views/issueDetails/streamline/eventDetails';

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
  let mockActionableItems, mockCommitters, mockTags;

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
  });

  it('displays all basic components', async function () {
    const mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
      method: 'GET',
    });
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
  });

  it('displays error messages from bad queries', async function () {
    const errorMessage = 'wrong, try again';
    const mockErrorStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {detail: errorMessage},
      method: 'GET',
      statusCode: 400,
    });

    render(<EventDetails {...defaultProps} />, {organization});
    await screen.findByText(event.id);

    expect(mockErrorStats).toHaveBeenCalled();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    // Omit the graph
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });
});
