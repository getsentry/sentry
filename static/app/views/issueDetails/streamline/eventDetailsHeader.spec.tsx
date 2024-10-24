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
  const defaultProps = {group, event};
  const router = RouterFixture({
    location: LocationFixture({query: {streamline: '1'}}),
  });

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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
      method: 'GET',
    });
  });

  it('renders filters alongside the graph', async function () {
    render(<EventDetailsHeader {...defaultProps} />, {organization, router});
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'All Envs'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '14D'})).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter events...')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Toggle graph series - Events',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Toggle graph series - Users'})
    ).toBeInTheDocument();
    expect(screen.getByRole('figure')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open in Discover'})).toBeInTheDocument();
  });

  it('updates the query params with search tokens', async function () {
    const [tagKey, tagValue] = ['user.email', 'leander.rodrigues@sentry.io'];
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

    render(<EventDetailsHeader {...defaultProps} />, {organization, router});
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();

    const search = screen.getByPlaceholderText('Filter events...');
    await userEvent.type(search, `${tagKey}:`);
    await userEvent.keyboard(`${tagValue}{enter}{enter}`);
    expect(mockUseNavigate).toHaveBeenCalledWith(expect.objectContaining(locationQuery), {
      replace: true,
    });
  });
});
