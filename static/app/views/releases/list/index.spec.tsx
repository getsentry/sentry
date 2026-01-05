import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {ReleasesSortOption} from 'sentry/constants/releases';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import ReleasesList from 'sentry/views/releases/list/';
import {ReleasesDisplayOption} from 'sentry/views/releases/list/releasesDisplayOptions';
import {ReleasesStatusOption} from 'sentry/views/releases/list/releasesStatusOptions';

describe('ReleasesList', () => {
  const organization = OrganizationFixture({
    features: ['search-query-builder-input-flow-changes', 'preprod-frontend-routes'],
  });
  const projects = [ProjectFixture({features: ['releases']})];
  const semverVersionInfo = {
    buildHash: null,
    description: '1.2.3',
    package: 'package',
    version: {
      raw: '1.2.3',
      major: 1,
      minor: 2,
      patch: 3,
      buildCode: null,
      components: 3,
    },
  };

  let endpointMock: jest.Mock;
  let sessionApiMock: jest.Mock;

  beforeEach(() => {
    act(() => ProjectsStore.loadInitialData(projects));
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {period: null, utc: null, start: null, end: null},
    });
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [
        ReleaseFixture({
          version: '1.0.0',
          versionInfo: {
            ...semverVersionInfo,
            version: {...semverVersionInfo.version, raw: '1.0.0'},
          },
        }),
        ReleaseFixture({
          version: '1.0.1',
          versionInfo: {
            ...semverVersionInfo,
            version: {...semverVersionInfo.version, raw: '1.0.1'},
          },
        }),
        {
          ...ReleaseFixture({version: 'af4f231ec9a8'}),
          projects: [
            {
              id: 4383604,
              name: 'Sentry-IOS-Shop',
              slug: 'sentry-ios-shop',
              hasHealthData: false,
            },
          ],
        },
      ],
    });

    sessionApiMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/sessions/`,
      body: null,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${projects[0]!.slug}/`,
      body: [],
    });
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    MockApiClient.clearMockResponses();
  });

  it('renders list', async () => {
    PageFiltersStore.updateProjects([-1], null);
    render(<ReleasesList />, {organization});
    const items = await screen.findAllByTestId('release-panel');

    expect(items).toHaveLength(3);

    expect(within(items.at(0)!).getByText('1.0.0')).toBeInTheDocument();
    expect(within(items.at(0)!).getByText('Adoption')).toBeInTheDocument();
    expect(within(items.at(1)!).getByText('1.0.1')).toBeInTheDocument();

    expect(await within(items.at(1)!).findByText('0%')).toBeInTheDocument();
    expect(within(items.at(2)!).getByText('af4f231ec9a8')).toBeInTheDocument();
    expect(within(items.at(2)!).getByText('Project Slug')).toBeInTheDocument();
  });

  it('displays quickstart when appropriate', async () => {
    const projectWithoutReleases = ProjectFixture({
      id: '4',
      slug: 'test-slug-2',
      name: 'test-name-2',
      features: [],
    });
    ProjectsStore.loadInitialData([projectWithoutReleases]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sentry-apps/',
      body: [],
    });
    PageFiltersStore.updateProjects([Number(projectWithoutReleases.id)], null);
    render(<ReleasesList />, {organization});
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(await screen.findByText('Set up Releases')).toBeInTheDocument();
    expect(screen.queryByTestId('release-panel')).not.toBeInTheDocument();
  });

  it('displays query empty state', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({features: ['releases']})]);
    MockApiClient.addMockResponse({url: '/organizations/org-slug/releases/', body: []});
    render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {query: 'abc'},
        },
      },
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(
      await screen.findByText("There are no releases that match: 'abc'.")
    ).toBeInTheDocument();
  });

  it('displays date range empty state', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({features: ['releases']})]);
    MockApiClient.addMockResponse({url: '/organizations/org-slug/releases/', body: []});
    render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {
            sort: ReleasesSortOption.SESSIONS,
            statsPeriod: '7d',
          },
        },
      },
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(
      await screen.findByText('There are no releases with data in the last 7 days.')
    ).toBeInTheDocument();
  });

  it('displays the sorted empty state', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({features: ['releases']})]);
    MockApiClient.addMockResponse({url: '/organizations/org-slug/releases/', body: []});
    const {unmount: unmountUser24Hours} = render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {
            sort: ReleasesSortOption.USERS_24_HOURS,
            statsPeriod: '7d',
          },
        },
      },
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        'There are no releases with active user data (users in the last 24 hours).'
      )
    ).toBeInTheDocument();
    unmountUser24Hours();

    const {unmount: unmountSession24Hours} = render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {
            sort: ReleasesSortOption.SESSIONS_24_HOURS,
            statsPeriod: '7d',
          },
        },
      },
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        'There are no releases with active session data (sessions in the last 24 hours).'
      )
    ).toBeInTheDocument();
    unmountSession24Hours();

    render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {sort: ReleasesSortOption.BUILD},
        },
      },
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(
      await screen.findByText('There are no releases with semantic versioning.')
    ).toBeInTheDocument();
  });

  it('displays request errors', async () => {
    const errorMessage = 'dumpster fire';
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: {
        detail: errorMessage,
      },
      statusCode: 400,
    });

    PageFiltersStore.updateProjects([3], null);
    render(<ReleasesList />, {organization});

    expect(await screen.findByText(errorMessage)).toBeInTheDocument();

    // we want release header to be visible despite the error message
    expect(
      await screen.findByRole('combobox', {
        name: 'Add a search term',
      })
    ).toBeInTheDocument();
  });

  it('searches for a release', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    const {router} = render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {query: 'derp'},
        },
      },
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    const input = await screen.findByDisplayValue('derp');
    expect(input).toBeInTheDocument();

    expect(endpointMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/releases/`,
      expect.objectContaining({
        query: expect.objectContaining({query: 'derp'}),
      })
    );

    await userEvent.clear(input);
    await userEvent.type(input, 'a{enter}');

    expect(router.location.query.query).toBe('a');
  });

  it('sorts releases', async () => {
    const {router} = render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {sort: ReleasesSortOption.SESSIONS},
        },
      },
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    expect(endpointMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/releases/`,
      expect.objectContaining({
        query: expect.objectContaining({
          sort: ReleasesSortOption.SESSIONS,
        }),
      })
    );

    await userEvent.click(screen.getByText('Sort By'));

    const dateCreatedOption = screen.getByText('Date Created');
    expect(dateCreatedOption).toBeInTheDocument();

    await userEvent.click(dateCreatedOption);

    expect(router.location.query.sort).toBe(ReleasesSortOption.DATE);
  });

  it('disables adoption sort when more than one environment is selected', async () => {
    PageFiltersStore.updateEnvironments(['a', 'b']);
    render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {sort: ReleasesSortOption.ADOPTION},
        },
      },
    });
    const sortDropdown = await screen.findByText('Sort By');

    expect(sortDropdown.parentElement).toHaveTextContent('Sort ByDate Created');
  });

  it('display the right Crash Free column', async () => {
    const {router} = render(<ReleasesList />, {organization});

    // Find and click on the display menu's trigger button
    const statusTriggerButton = screen.getByRole('button', {
      name: 'Display Sessions',
    });
    expect(statusTriggerButton).toBeInTheDocument();
    await userEvent.click(statusTriggerButton);

    // Expect to have 2 options in the status dropdown
    const crashFreeSessionsOption = screen.getAllByText('Sessions')[1];
    const crashFreeUsersOption = screen.getByText('Users');
    expect(crashFreeSessionsOption).toBeInTheDocument();
    expect(crashFreeUsersOption).toBeInTheDocument();

    await userEvent.click(crashFreeUsersOption);

    expect(router.location.query.display).toBe(ReleasesDisplayOption.USERS);
  });

  it('displays archived releases', async () => {
    const {router} = render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {status: ReleasesStatusOption.ARCHIVED},
        },
      },
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(endpointMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/releases/`,
      expect.objectContaining({
        query: expect.objectContaining({status: ReleasesStatusOption.ARCHIVED}),
      })
    );

    expect(
      await screen.findByText('These releases have been archived.')
    ).toBeInTheDocument();

    // Find and click on the status menu's trigger button
    const archivedTrigger = screen.getByRole('button', {name: 'Status Archived'});
    expect(archivedTrigger).toBeInTheDocument();
    await userEvent.click(archivedTrigger);

    // Expect to have 2 options in the status dropdown
    const statusActiveOption = screen.getByRole('option', {name: 'Active'});
    let statusArchivedOption = screen.getByRole('option', {name: 'Archived'});
    expect(statusActiveOption).toBeInTheDocument();
    expect(statusArchivedOption).toBeInTheDocument();

    await userEvent.click(statusActiveOption);
    expect(router.location.query.status).toBe(ReleasesStatusOption.ACTIVE);

    await userEvent.click(screen.getByRole('button', {name: 'Status Active'}));
    statusArchivedOption = screen.getByRole('option', {name: 'Archived'});
    await userEvent.click(statusArchivedOption);
    expect(router.location.query.status).toBe(ReleasesStatusOption.ARCHIVED);
  });

  it('calls api with only explicitly permitted query params', async () => {
    render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {somethingBad: 'XXX'},
        },
      },
    });
    await waitFor(() => {
      expect(endpointMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/releases/`,
        expect.objectContaining({
          query: expect.not.objectContaining({
            somethingBad: 'XXX',
          }),
        })
      );
    });
  });

  it('calls session api for health data', async () => {
    render(<ReleasesList />, {organization});

    await waitFor(() => expect(sessionApiMock).toHaveBeenCalledTimes(3));

    expect(sessionApiMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/sessions/`,
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['sum(session)'],
          groupBy: ['project', 'release', 'session.status'],
          interval: '1d',
          query: 'release:1.0.0 OR release:1.0.1 OR release:af4f231ec9a8',
          statsPeriod: '14d',
        }),
      })
    );

    expect(sessionApiMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/sessions/`,
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['sum(session)'],
          groupBy: ['project'],
          interval: '1h',
          query: undefined,
          statsPeriod: '24h',
        }),
      })
    );

    expect(sessionApiMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/sessions/`,
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['sum(session)'],
          groupBy: ['project', 'release'],
          interval: '1h',
          query: 'release:1.0.0 OR release:1.0.1 OR release:af4f231ec9a8',
          statsPeriod: '24h',
        }),
      })
    );
  });

  it('shows health rows only for selected projects in global header', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [
        {
          ...ReleaseFixture({version: '2.0.0'}),
          projects: [
            {
              id: 1,
              name: 'Test',
              slug: 'test',
            },
            {
              id: 2,
              name: 'Test2',
              slug: 'test2',
            },
            {
              id: 3,
              name: 'Test3',
              slug: 'test3',
            },
          ],
        },
      ],
    });
    PageFiltersStore.updateProjects([2], null);
    render(<ReleasesList />, {organization});
    const hiddenProjectsMessage = await screen.findByTestId('hidden-projects');
    expect(hiddenProjectsMessage).toHaveTextContent('2 hidden projects');

    expect(screen.getAllByTestId('release-card-project-row')).toHaveLength(1);

    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('test2');
  });

  it('does not hide health rows when "All Projects" are selected in global header', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [ReleaseFixture({version: '2.0.0'})],
    });
    PageFiltersStore.updateProjects([-1], null);
    render(<ReleasesList />, {organization});

    expect(await screen.findByTestId('release-card-project-row')).toBeInTheDocument();
    expect(screen.queryByTestId('hidden-projects')).not.toBeInTheDocument();
  });

  it('renders mobile builds when the mobile-builds tab is selected', async () => {
    const mobileProject = ProjectFixture({
      id: '12',
      slug: 'mobile-project',
      platform: 'android',
      features: ['releases'],
    });

    ProjectsStore.loadInitialData([mobileProject]);
    PageFiltersStore.updateProjects([Number(mobileProject.id)], null);

    const buildsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/preprodartifacts/list-builds/`,
      body: {builds: []},
    });

    render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {tab: 'mobile-builds', statsPeriod: '7d'},
        },
      },
    });

    expect(await screen.findByText(/No mobile builds found/)).toBeInTheDocument();

    expect(buildsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/preprodartifacts/list-builds/`,
      expect.objectContaining({
        query: expect.objectContaining({per_page: 25, statsPeriod: '7d'}),
      })
    );
  });

  it('toggles display mode in the mobile-builds tab', async () => {
    const organizationWithDistribution = OrganizationFixture({
      slug: organization.slug,
      features: [...organization.features, 'preprod-build-distribution'],
    });
    const mobileProject = ProjectFixture({
      id: '15',
      slug: 'mobile-project-4',
      platform: 'android',
      features: ['releases'],
    });

    ProjectsStore.loadInitialData([mobileProject]);
    PageFiltersStore.updateProjects([Number(mobileProject.id)], null);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/preprodartifacts/list-builds/`,
      body: {
        builds: [
          {
            id: 'build-id',
            project_id: 15,
            project_slug: 'mobile-project-4',
            state: 1,
            app_info: {
              app_id: 'com.example.app',
              name: 'Example App',
              platform: 'android',
              build_number: '1',
              version: '1.0.0',
              date_added: '2024-01-01T00:00:00Z',
            },
            distribution_info: {
              is_installable: true,
              download_count: 12,
              release_notes: null,
            },
            size_info: {},
            vcs_info: {
              head_sha: 'abcdef1',
              pr_number: 123,
              head_ref: 'main',
            },
          },
        ],
      },
    });

    const {router} = render(<ReleasesList />, {
      organization: organizationWithDistribution,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {tab: 'mobile-builds', cursor: '123', display: 'users'},
        },
      },
    });

    expect(await screen.findByText('Example App')).toBeInTheDocument();

    const displayTrigger = screen.getByRole('button', {name: 'Display Size'});
    await userEvent.click(displayTrigger);

    const distributionOption = screen.getByRole('option', {name: 'Distribution'});
    await userEvent.click(distributionOption);

    expect(router.location.query.display).toBe(PreprodBuildsDisplay.DISTRIBUTION);
    expect(router.location.query.cursor).toBeUndefined();
  });

  it('allows searching within the mobile-builds tab', async () => {
    const mobileProject = ProjectFixture({
      id: '13',
      slug: 'mobile-project-2',
      platform: 'android',
      features: ['releases'],
    });

    ProjectsStore.loadInitialData([mobileProject]);
    PageFiltersStore.updateProjects([Number(mobileProject.id)], null);

    const buildsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/preprodartifacts/list-builds/`,
      body: {
        builds: [
          {
            id: 'build-id',
            project_id: 13,
            project_slug: 'mobile-project-2',
            state: 1,
            app_info: {
              app_id: 'com.example.app',
              name: 'Example App',
              platform: 'android',
              build_number: '1',
              version: '1.0.0',
              date_added: '2024-01-01T00:00:00Z',
            },
            size_info: {},
            vcs_info: {
              head_sha: 'abcdef1',
              pr_number: 123,
              head_ref: 'main',
            },
          },
        ],
      },
    });

    render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {tab: 'mobile-builds', query: 'sha:abcdef1'},
        },
      },
    });

    expect(
      await screen.findByPlaceholderText(
        'Search by build, SHA, branch name, or pull request'
      )
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(buildsMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/preprodartifacts/list-builds/`,
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 25,
            statsPeriod: '14d',
            query: 'sha:abcdef1',
          }),
        })
      )
    );

    const searchInput = screen.getByPlaceholderText(
      'Search by build, SHA, branch name, or pull request'
    );

    // Clear the input first
    await userEvent.clear(searchInput);

    // Type the search term and press Enter to submit
    await userEvent.type(searchInput, 'branch:main{enter}');

    // Wait for the API call with the complete search query
    await waitFor(() =>
      expect(buildsMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/preprodartifacts/list-builds/`,
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 25,
            statsPeriod: '14d',
            query: 'branch:main',
          }),
        })
      )
    );
  });

  it('resets tab when switching back to releases tab from mobile builds', async () => {
    const mobileProject = ProjectFixture({
      id: '14',
      slug: 'mobile-project-3',
      platform: 'android',
      features: ['releases'],
    });

    ProjectsStore.loadInitialData([mobileProject]);
    PageFiltersStore.updateProjects([Number(mobileProject.id)], null);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/preprodartifacts/list-builds/`,
      body: {builds: []},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [],
    });

    const {router} = render(<ReleasesList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/`,
          query: {tab: 'mobile-builds', query: 'sha:abcdef1', statsPeriod: '7d'},
        },
      },
    });

    await userEvent.click(
      screen.getByRole('tab', {
        name: 'Releases',
      })
    );

    expect(router.location.query.tab).toBeUndefined();
  });

  it('autocompletes semver search tag', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/release.version/values/`,
      body: [
        {
          count: null,
          firstSeen: null,
          key: 'release.version',
          lastSeen: null,
          name: 'sentry@0.5.3',
          value: 'sentry@0.5.3',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'POST',
    });
    render(<ReleasesList />, {organization});
    const smartSearchBar = await screen.findByRole('combobox', {
      name: 'Add a search term',
    });
    await userEvent.click(smartSearchBar);
    await userEvent.clear(smartSearchBar);
    expect(await screen.findByRole('option', {name: 'release'})).toBeInTheDocument();

    await userEvent.clear(smartSearchBar);
    await userEvent.click(screen.getByRole('option', {name: 'release.version'}));

    expect(await screen.findByText('sentry@0.5.3')).toBeInTheDocument();
  });
});
