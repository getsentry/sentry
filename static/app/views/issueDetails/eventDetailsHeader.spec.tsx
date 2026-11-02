import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {IssueCategory, IssueType} from 'sentry/types/group';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';

import {EventDetailsHeader} from './eventDetailsHeader';

describe('EventDetailsHeader', () => {
  const organization = OrganizationFixture();
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
    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <EventDetailsHeader {...defaultProps} />
      </GroupDataContextProvider>,
      {
        organization,
      }
    );
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'All Envs'})).toBeInTheDocument();
    // Date selection is based on first seen unless selected by the user
    expect(
      screen.getByRole('button', {name: 'Since First Seen (19 days)'})
    ).toBeInTheDocument();
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
    render(
      <GroupDataContextProvider group={oldGroup} project={oldGroup.project}>
        <EventDetailsHeader {...defaultProps} group={oldGroup} />
      </GroupDataContextProvider>,
      {
        organization,
      }
    );
    expect(await screen.findByRole('button', {name: '90D'})).toBeInTheDocument();
  });

  const regressedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const regressionFeatures = ['issue-details-since-regressed'];

  it.each([
    {
      name: 'uses the latest regression when enabled',
      features: regressionFeatures,
      activeAt: regressedAt,
      label: 'Since Regressed (20 minutes)',
      statsPeriod: '2h',
    },
    {
      name: 'uses first seen when disabled',
      features: [],
      activeAt: regressedAt,
      label: 'Since First Seen (19 days)',
      statsPeriod: '20d',
    },
    {
      name: 'uses first seen when the API does not provide activeAt',
      features: regressionFeatures,
      activeAt: undefined,
      label: 'Since First Seen (19 days)',
      statsPeriod: '20d',
    },
    {
      name: 'uses first seen when activeAt is null',
      features: regressionFeatures,
      activeAt: null,
      label: 'Since First Seen (19 days)',
      statsPeriod: '20d',
    },
    {
      name: 'uses first seen for an issue that has never regressed',
      features: regressionFeatures,
      activeAt: group.firstSeen,
      label: 'Since First Seen (19 days)',
      statsPeriod: '20d',
    },
    {
      name: 'rounds older regressions up to whole days',
      features: regressionFeatures,
      activeAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      label: 'Since Regressed (2 days)',
      statsPeriod: '3d',
    },
  ])('$name', async ({features, activeAt, label, statsPeriod}) => {
    const regressedGroup = GroupFixture({...group, activeAt});
    const eventStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
    });

    render(
      <GroupDataContextProvider group={regressedGroup} project={project}>
        <EventDetailsHeader {...defaultProps} group={regressedGroup} />
      </GroupDataContextProvider>,
      {organization: OrganizationFixture({features})}
    );

    expect(await screen.findByRole('button', {name: label})).toBeInTheDocument();
    await waitFor(() => {
      expect(eventStats).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-stats/`,
        expect.objectContaining({query: expect.objectContaining({statsPeriod})})
      );
    });
  });

  it('preserves a selected time range and lets the user return to since regressed', async () => {
    const regressedGroup = GroupFixture({...group, activeAt: regressedAt});
    const {router} = render(
      <GroupDataContextProvider group={regressedGroup} project={project}>
        <EventDetailsHeader {...defaultProps} group={regressedGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: regressionFeatures}),
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/${group.id}/`,
            query: {statsPeriod: '7d'},
          },
        },
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: '7D'}));
    expect(router.location.query.statsPeriod).toBe('7d');
    await userEvent.click(
      screen.getByRole('option', {name: 'Last 20 minutes (since regressed)'})
    );

    expect(
      await screen.findByRole('button', {name: 'Since Regressed (20 minutes)'})
    ).toBeInTheDocument();
    expect(router.location.query.statsPeriod).toBeUndefined();
  });

  it('resets pagination when searching while preserving the other filters', async () => {
    const [tagKey, tagValue] = ['user.email', 's@s.io'];
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

    const {router} = render(
      <GroupDataContextProvider group={group} project={group.project}>
        <EventDetailsHeader {...defaultProps} />
      </GroupDataContextProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
            query: {
              cursor: '2:0:0',
              environment: 'production',
              statsPeriod: '7d',
              sort: 'timestamp',
            },
          },
        },
      }
    );
    expect(router.location.query.cursor).toBe('2:0:0');

    const search = await screen.findByPlaceholderText('Filter events\u2026');
    await userEvent.type(search, `${tagKey}:`, {delay: null});
    await userEvent.click(await screen.findByRole('option', {name: tagValue}));
    await waitFor(() => {
      expect(router.location.query).toEqual({
        environment: 'production',
        statsPeriod: '7d',
        sort: 'timestamp',
        query: `${tagKey}:${tagValue}`,
      });
    });
  }, 20_000);

  it('resets pagination when changing the time range while preserving the other filters', async () => {
    const {router} = render(
      <GroupDataContextProvider group={group} project={group.project}>
        <EventDetailsHeader {...defaultProps} />
      </GroupDataContextProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
            query: {
              cursor: '2:0:0',
              environment: 'production',
              statsPeriod: '7d',
              sort: 'timestamp',
              query: 'release:1.0',
            },
          },
        },
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: '7D'}));
    expect(router.location.query.cursor).toBe('2:0:0');
    await userEvent.click(screen.getByRole('option', {name: 'Last 24 hours'}));

    await waitFor(() => {
      expect(router.location.query).toEqual({
        environment: 'production',
        statsPeriod: '24h',
        sort: 'timestamp',
        query: 'release:1.0',
      });
    });
  });

  it('does not render timeline summary if disabled', async () => {
    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <EventDetailsHeader {...defaultProps} />
      </GroupDataContextProvider>,
      {
        organization,
      }
    );
    expect(await screen.findByTestId('event-graph-loading')).not.toBeInTheDocument();
    expect(screen.queryByText('Duration')).not.toBeInTheDocument();
  });

  it('renders occurrence summary if enabled', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: {data: event},
    });
    const uptimeGroup = GroupFixture({
      issueCategory: IssueCategory.UPTIME,
      issueType: IssueType.UPTIME_DOMAIN_FAILURE,
    });
    render(
      <GroupDataContextProvider group={uptimeGroup} project={uptimeGroup.project}>
        <EventDetailsHeader
          {...defaultProps}
          group={uptimeGroup}
          event={EventFixture({
            occurrence: {
              evidenceData: {},
              evidenceDisplay: [
                {name: 'Status Code', value: '500'},
                {name: 'Failure reason', value: 'bad things'},
              ],
            },
          })}
        />
      </GroupDataContextProvider>,
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
