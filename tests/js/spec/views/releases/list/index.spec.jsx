import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import ReleasesList from 'sentry/views/releases/list/';
import {ReleasesDisplayOption} from 'sentry/views/releases/list/releasesDisplayOptions';
import {ReleasesSortOption} from 'sentry/views/releases/list/releasesSortOptions';
import {ReleasesStatusOption} from 'sentry/views/releases/list/releasesStatusOptions';

describe('ReleasesList', function () {
  enforceActOnUseLegacyStoreHook();

  const {organization, routerContext, router} = initializeOrg();

  const props = {
    router,
    organization,
    selection: {
      projects: [],
      environments: [],
      datetime: {
        period: '14d',
      },
    },
    params: {orgId: organization.slug},
    location: {
      query: {
        query: 'derp',
        sort: ReleasesSortOption.SESSIONS,
        healthStatsPeriod: '24h',
        somethingBad: 'XXX',
        status: ReleasesStatusOption.ACTIVE,
      },
    },
  };
  let wrapper, endpointMock, sessionApiMock;

  function createWrapper(releaseList, context) {
    return mountWithTheme(
      <OrganizationContext.Provider value={organization}>
        {releaseList}
      </OrganizationContext.Provider>,
      context
    );
  }

  beforeEach(async function () {
    ProjectsStore.loadInitialData(organization.projects);
    endpointMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [
        TestStubs.Release({version: '1.0.0'}),
        TestStubs.Release({version: '1.0.1'}),
        {
          ...TestStubs.Release({version: 'af4f231ec9a8'}),
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

    wrapper = createWrapper(<ReleasesList {...props} />, routerContext);
    await tick();
    wrapper.update();
  });

  afterEach(function () {
    wrapper.unmount();
    act(() => ProjectsStore.reset());
    MockApiClient.clearMockResponses();
  });

  it('renders list', function () {
    const items = wrapper.find('StyledPanel');

    expect(items).toHaveLength(3);
    expect(items.at(0).text()).toContain('1.0.0');
    expect(items.at(0).text()).toContain('Adoption');
    expect(items.at(1).text()).toContain('1.0.1');
    expect(items.at(1).find('AdoptionColumn').at(1).text()).toContain('0%');
    expect(items.at(2).text()).toContain('af4f231ec9a8');
    expect(items.at(2).find('ReleaseProjectsHeader').text()).toContain('Project');
  });

  it('displays the right empty state', function () {
    let location;
    const project = TestStubs.Project({
      id: '3',
      slug: 'test-slug',
      name: 'test-name',
      features: ['releases'],
    });
    const org = TestStubs.Organization({projects: [project]});
    ProjectsStore.loadInitialData(org.projects);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });

    // does not have releases set up and no releases
    location = {query: {}};
    wrapper = createWrapper(
      <ReleasesList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('StyledPanel')).toHaveLength(0);
    expect(wrapper.find('ReleasesPromo').text()).toContain('Demystify Releases');

    location = {query: {statsPeriod: '30d'}};
    wrapper = createWrapper(
      <ReleasesList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('StyledPanel')).toHaveLength(0);
    expect(wrapper.find('ReleasesPromo').text()).toContain('Demystify Releases');

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/releases/`,
      body: [],
    });

    // has releases set up and no releases
    location = {query: {query: 'abc'}};
    let container = createWrapper(
      <ReleasesList
        {...props}
        organization={org}
        location={location}
        selection={{...props.selection, projects: [3]}}
      />,
      routerContext
    );
    expect(container.find('EmptyMessage').text()).toEqual(
      "There are no releases that match: 'abc'."
    );

    location = {query: {sort: ReleasesSortOption.SESSIONS, statsPeriod: '7d'}};
    container = createWrapper(
      <ReleasesList
        {...props}
        organization={org}
        location={location}
        selection={{...props.selection, projects: [3]}}
      />,
      routerContext
    );
    expect(container.find('EmptyMessage').text()).toEqual(
      'There are no releases with data in the last 7 days.'
    );

    location = {query: {sort: ReleasesSortOption.USERS_24_HOURS, statsPeriod: '7d'}};
    container = createWrapper(
      <ReleasesList
        {...props}
        organization={org}
        location={location}
        selection={{...props.selection, projects: [3]}}
      />,
      routerContext
    );
    expect(container.find('EmptyMessage').text()).toEqual(
      'There are no releases with active user data (users in the last 24 hours).'
    );

    location = {query: {sort: ReleasesSortOption.SESSIONS_24_HOURS, statsPeriod: '7d'}};
    container = createWrapper(
      <ReleasesList
        {...props}
        organization={org}
        location={location}
        selection={{...props.selection, projects: [3]}}
      />,
      routerContext
    );
    expect(container.find('EmptyMessage').text()).toEqual(
      'There are no releases with active session data (sessions in the last 24 hours).'
    );

    location = {query: {sort: ReleasesSortOption.BUILD}};
    container = createWrapper(
      <ReleasesList
        {...props}
        organization={org}
        location={location}
        selection={{...props.selection, projects: [3]}}
      />,
      routerContext
    );
    expect(container.find('EmptyMessage').text()).toEqual(
      'There are no releases with semantic versioning.'
    );
  });

  it('displays request errors', function () {
    const errorMessage = 'dumpster fire';
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: {
        detail: errorMessage,
      },
      statusCode: 400,
    });

    wrapper = createWrapper(<ReleasesList {...props} />, routerContext);
    expect(wrapper.find('LoadingError').text()).toBe(errorMessage);

    // we want release header to be visible despite the error message
    expect(wrapper.find('SortAndFilterWrapper').exists()).toBeTruthy();
  });

  it('searches for a release', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    const input = wrapper.find('textarea');

    expect(endpointMock).toHaveBeenCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        query: expect.objectContaining({query: 'derp'}),
      })
    );

    expect(input.prop('value')).toBe('derp ');

    input.simulate('change', {target: {value: 'a'}}).simulate('submit');

    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({query: 'a'}),
    });
  });

  it('sorts releases', function () {
    expect(endpointMock).toHaveBeenCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        query: expect.objectContaining({
          sort: ReleasesSortOption.SESSIONS,
        }),
      })
    );

    const sortDropdown = wrapper.find('ReleasesSortOptions');
    const sortByOptions = sortDropdown.find('DropdownItem span');

    const dateCreatedOption = sortByOptions.at(0);
    expect(sortByOptions).toHaveLength(7);
    expect(dateCreatedOption.text()).toEqual('Date Created');

    const healthStatsControls = wrapper.find('AdoptionColumn span').first();
    expect(healthStatsControls.text()).toEqual('Adoption');

    dateCreatedOption.simulate('click');

    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        sort: ReleasesSortOption.DATE,
      }),
    });
  });

  it('disables adoption sort when more than one environment is selected', function () {
    wrapper.unmount();
    const adoptionProps = {
      ...props,
      organization,
    };
    wrapper = createWrapper(
      <ReleasesList
        {...adoptionProps}
        location={{query: {sort: ReleasesSortOption.ADOPTION}}}
        selection={{...props.selection, environments: ['a', 'b']}}
      />,
      routerContext
    );
    const sortDropdown = wrapper.find('ReleasesSortOptions');
    expect(sortDropdown.find('ButtonLabel').text()).toBe('Sort ByDate Created');
  });

  it('display the right Crash Free column', async function () {
    const displayDropdown = wrapper.find('ReleasesDisplayOptions');

    const activeDisplay = displayDropdown.find('DropdownButton button');
    expect(activeDisplay.text()).toEqual('DisplaySessions');

    const displayOptions = displayDropdown.find('DropdownItem');
    expect(displayOptions).toHaveLength(2);

    const crashFreeSessionsOption = displayOptions.at(0);
    expect(crashFreeSessionsOption.props().isActive).toEqual(true);
    expect(crashFreeSessionsOption.text()).toEqual('Sessions');

    const crashFreeUsersOption = displayOptions.at(1);
    expect(crashFreeUsersOption.text()).toEqual('Users');
    expect(crashFreeUsersOption.props().isActive).toEqual(false);

    crashFreeUsersOption.find('span').simulate('click');

    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        display: ReleasesDisplayOption.USERS,
      }),
    });
  });

  it('displays archived releases', function () {
    const archivedWrapper = createWrapper(
      <ReleasesList
        {...props}
        location={{query: {status: ReleasesStatusOption.ARCHIVED}}}
      />,
      routerContext
    );

    expect(endpointMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        query: expect.objectContaining({status: ReleasesStatusOption.ARCHIVED}),
      })
    );

    expect(archivedWrapper.find('ReleaseArchivedNotice').exists()).toBeTruthy();

    const statusOptions = archivedWrapper
      .find('ReleasesStatusOptions')
      .first()
      .find('DropdownItem span');
    const statusActiveOption = statusOptions.at(0);
    const statusArchivedOption = statusOptions.at(1);

    expect(statusOptions).toHaveLength(2);
    expect(statusActiveOption.text()).toEqual('Active');
    expect(statusArchivedOption.text()).toEqual('Archived');

    statusActiveOption.simulate('click');
    expect(router.push).toHaveBeenLastCalledWith({
      query: expect.objectContaining({
        status: ReleasesStatusOption.ACTIVE,
      }),
    });

    expect(wrapper.find('ReleaseArchivedNotice').exists()).toBeFalsy();

    statusArchivedOption.simulate('click');
    expect(router.push).toHaveBeenLastCalledWith({
      query: expect.objectContaining({
        status: ReleasesStatusOption.ARCHIVED,
      }),
    });
  });

  it('calls api with only explicitly permitted query params', function () {
    expect(endpointMock).toHaveBeenCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        query: expect.not.objectContaining({
          somethingBad: 'XXX',
        }),
      })
    );
  });

  it('calls session api for health data', async function () {
    expect(sessionApiMock).toHaveBeenCalledTimes(3);

    expect(sessionApiMock).toHaveBeenCalledWith(
      '/organizations/org-slug/sessions/',
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
      '/organizations/org-slug/sessions/',
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
      '/organizations/org-slug/sessions/',
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

  it('shows health rows only for selected projects in global header', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [
        {
          ...TestStubs.Release({version: '2.0.0'}),
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
    const healthSection = createWrapper(
      <ReleasesList {...props} selection={{...props.selection, projects: [2]}} />,
      routerContext
    ).find('ReleaseProjects');
    const hiddenProjectsMessage = healthSection.find('HiddenProjectsMessage');

    expect(hiddenProjectsMessage.text()).toBe('2 hidden projects');

    expect(hiddenProjectsMessage.find('Tooltip').prop('title')).toBe('test, test3');

    expect(healthSection.find('ReleaseCardProjectRow').length).toBe(1);

    expect(healthSection.find('ProjectBadge').text()).toBe('test2');
  });

  it('does not hide health rows when "All Projects" are selected in global header', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [TestStubs.Release({version: '2.0.0'})],
    });
    const healthSection = createWrapper(
      <ReleasesList {...props} selection={{...props.selection, projects: [-1]}} />,
      routerContext
    ).find('ReleaseProjects');

    expect(healthSection.find('HiddenProjectsMessage').exists()).toBeFalsy();

    expect(healthSection.find('ReleaseCardProjectRow').length).toBe(1);
  });

  it('autocompletes semver search tag', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release.version/values/',
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
    wrapper.find('SmartSearchBar textarea').simulate('click');
    wrapper
      .find('SmartSearchBar textarea')
      .simulate('change', {target: {value: 'sentry.semv'}});

    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="search-autocomplete-item"]').at(0).text()).toBe(
      'release:'
    );

    wrapper.find('SmartSearchBar textarea').simulate('focus');
    wrapper
      .find('SmartSearchBar textarea')
      .simulate('change', {target: {value: 'release.version:'}});

    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="search-autocomplete-item"]').at(4).text()).toBe(
      'sentry@0.5.3'
    );
  });
});
