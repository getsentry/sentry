import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import ProjectsStore from 'sentry/stores/projectsStore';
import {IssueCategory, IssueType} from 'sentry/types/group';

import {EventDetailsHeader} from './eventDetailsHeader';

const mockUseNavigate = jest.fn();
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => mockUseNavigate,
}));

jest.mock('sentry/views/issueDetails/utils', () => ({
  ...jest.requireActual('sentry/views/issueDetails/utils'),
  useHasStreamlinedUI: () => true,
}));

describe('EventDetailsHeader', () => {
  const organization = OrganizationFixture({
    features: ['search-query-builder-input-flow-changes'],
  });
  const project = ProjectFixture({
    environments: ['production', 'staging', 'development'],
  });
  const group = GroupFixture({
    // first seen 19 days ago
    firstSeen: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const event = EventFixture({
    id: 'event-id',
    occurrence: {evidenceData: {}},
  });

  const defaultProps = {group, event, project};
  const router = RouterFixture();

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
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [{'count_unique(user)': 21}]},
    });
  });

  it('renders filters alongside the graph', async () => {
    render(<EventDetailsHeader {...defaultProps} />, {
      organization,
    });
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'All Envs'})).toBeInTheDocument();
    // Date selection is based on first seen unless selected by the user
    expect(screen.getByRole('button', {name: 'Since First Seen'})).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter events\u2026')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Toggle graph series - Events',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Toggle graph series - Users'})
    ).toBeInTheDocument();
    expect(screen.getByRole('figure')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Close sidebar'})).toBeInTheDocument();
  });

  it('renders 90d instead of "Since First Seen" when the issue is older than 90d', async () => {
    const oldGroup = GroupFixture({
      firstSeen: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString(),
    });
    render(<EventDetailsHeader {...defaultProps} group={oldGroup} />, {
      organization,
    });
    expect(await screen.findByRole('button', {name: '90D'})).toBeInTheDocument();
  });

  it('updates the query params with search tokens', async () => {
    const [tagKey, tagValue] = ['user.email', 's@s.io'];
    const locationQuery = {
      query: {
        ...router.location.query,
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

    render(<EventDetailsHeader {...defaultProps} />, {
      organization,
    });
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();

    const search = await screen.findByPlaceholderText('Filter events\u2026');
    await userEvent.type(search, `${tagKey}:`, {delay: null});
    await userEvent.click(screen.getByRole('option', {name: 'is'}));
    await userEvent.keyboard(`${tagValue}{enter}`, {delay: null});
    await waitFor(() => {
      expect(mockUseNavigate).toHaveBeenCalledWith(
        expect.objectContaining(locationQuery),
        {replace: true}
      );
    });
  }, 20_000);

  it('does not render timeline summary if disabled', async () => {
    render(<EventDetailsHeader {...defaultProps} />, {
      organization,
    });
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();
    expect(screen.queryByText('Duration')).not.toBeInTheDocument();
  });

  it('renders occurrence summary if enabled', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: {data: event},
    });
    render(
      <EventDetailsHeader
        {...defaultProps}
        group={GroupFixture({
          issueCategory: IssueCategory.UPTIME,
          issueType: IssueType.UPTIME_DOMAIN_FAILURE,
        })}
        event={EventFixture({
          occurrence: {
            evidenceData: {},
            evidenceDisplay: [
              {name: 'Status Code', value: '500'},
              {name: 'Failure reason', value: 'bad things'},
            ],
          },
        })}
      />,
      {
        organization,
      }
    );
    expect(await screen.findByText('Status Code')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('bad things')).toBeInTheDocument();
  });
});
