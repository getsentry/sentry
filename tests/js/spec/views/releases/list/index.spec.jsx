import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectsStore from 'app/stores/projectsStore';
import ReleasesList from 'app/views/releases/list/';
import {DisplayOption, SortOption, StatusOption} from 'app/views/releases/list/utils';

describe('ReleasesList', function () {
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
        sort: SortOption.SESSIONS,
        healthStatsPeriod: '24h',
        somethingBad: 'XXX',
        status: StatusOption.ACTIVE,
      },
    },
  };
  let wrapper, endpointMock, sessionApiMock;

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

    wrapper = mountWithTheme(<ReleasesList {...props} />, routerContext);
    await tick();
    wrapper.update();
  });

  afterEach(function () {
    wrapper.unmount();
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('renders list', function () {
    const items = wrapper.find('StyledPanel');

    expect(items).toHaveLength(3);
    expect(items.at(0).text()).toContain('1.0.0');
    expect(items.at(0).text()).toContain('Adoption');
    expect(items.at(1).text()).toContain('1.0.1');
    expect(items.at(1).find('AdoptionColumn').at(1).text()).toContain('\u2014');
    expect(items.at(2).text()).toContain('af4f231ec9a8');
    expect(items.at(2).find('Header').text()).toContain('Project');
  });

  it('displays the right empty state', function () {
    let location;
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });

    location = {query: {}};
    wrapper = mountWithTheme(
      <ReleasesList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('StyledPanel')).toHaveLength(0);
    expect(wrapper.find('ReleasePromo').text()).toContain('Demystify Releases');

    location = {query: {statsPeriod: '30d'}};
    wrapper = mountWithTheme(
      <ReleasesList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('StyledPanel')).toHaveLength(0);
    expect(wrapper.find('ReleasePromo').text()).toContain('Demystify Releases');

    location = {query: {query: 'abc'}};
    wrapper = mountWithTheme(
      <ReleasesList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('EmptyMessage').text()).toEqual(
      "There are no releases that match: 'abc'."
    );

    location = {query: {sort: SortOption.SESSIONS, statsPeriod: '7d'}};
    wrapper = mountWithTheme(
      <ReleasesList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('EmptyMessage').text()).toEqual(
      'There are no releases with data in the last 7 days.'
    );

    location = {query: {sort: SortOption.USERS_24_HOURS, statsPeriod: '7d'}};
    wrapper = mountWithTheme(
      <ReleasesList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('EmptyMessage').text()).toEqual(
      'There are no releases with active user data (users in the last 24 hours).'
    );

    location = {query: {sort: SortOption.SESSIONS_24_HOURS, statsPeriod: '7d'}};
    wrapper = mountWithTheme(
      <ReleasesList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('EmptyMessage').text()).toEqual(
      'There are no releases with active session data (sessions in the last 24 hours).'
    );

    location = {query: {sort: SortOption.BUILD}};
    wrapper = mountWithTheme(
      <ReleasesList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('EmptyMessage').text()).toEqual(
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

    wrapper = mountWithTheme(<ReleasesList {...props} />, routerContext);
    expect(wrapper.find('LoadingError').text()).toBe(errorMessage);

    // we want release header to be visible despite the error message
    expect(wrapper.find('SortAndFilterWrapper').exists()).toBeTruthy();
  });

  it('searches for a release', function () {
    const input = wrapper.find('input');

    expect(endpointMock).toHaveBeenCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        query: expect.objectContaining({query: 'derp'}),
      })
    );

    expect(input.prop('value')).toBe('derp');

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
          sort: SortOption.SESSIONS,
        }),
      })
    );

    const sortDropdown = wrapper.find('ReleaseListSortOptions');
    const sortByOptions = sortDropdown.find('DropdownItem span');

    const dateCreatedOption = sortByOptions.at(0);
    expect(sortByOptions).toHaveLength(4);
    expect(dateCreatedOption.text()).toEqual('Date Created');

    const healthStatsControls = wrapper.find('AdoptionColumn span').first();
    expect(healthStatsControls.text()).toEqual('Adoption');

    dateCreatedOption.simulate('click');

    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        sort: SortOption.DATE,
      }),
    });
  });

  it('display the right Crash Free column', async function () {
    const displayDropdown = wrapper.find('ReleaseListDisplayOptions');

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
        display: DisplayOption.USERS,
      }),
    });
  });

  it('displays archived releases', function () {
    const archivedWrapper = mountWithTheme(
      <ReleasesList {...props} location={{query: {status: StatusOption.ARCHIVED}}} />,
      routerContext
    );

    expect(endpointMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        query: expect.objectContaining({status: StatusOption.ARCHIVED}),
      })
    );

    expect(archivedWrapper.find('ReleaseArchivedNotice').exists()).toBeTruthy();

    const statusOptions = archivedWrapper
      .find('ReleaseListStatusOptions')
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
        status: StatusOption.ACTIVE,
      }),
    });

    expect(wrapper.find('ReleaseArchivedNotice').exists()).toBeFalsy();

    statusArchivedOption.simulate('click');
    expect(router.push).toHaveBeenLastCalledWith({
      query: expect.objectContaining({
        status: StatusOption.ARCHIVED,
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
    const healthSection = mountWithTheme(
      <ReleasesList {...props} selection={{...props.selection, projects: [2]}} />,
      routerContext
    ).find('ReleaseHealth');
    const hiddenProjectsMessage = healthSection.find('HiddenProjectsMessage');

    expect(hiddenProjectsMessage.text()).toBe('2 hidden projects');

    expect(hiddenProjectsMessage.find('Tooltip').prop('title')).toBe('test, test3');

    expect(healthSection.find('ProjectRow').length).toBe(1);

    expect(healthSection.find('ProjectBadge').text()).toBe('test2');
  });

  it('does not hide health rows when "All Projects" are selected in global header', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [TestStubs.Release({version: '2.0.0'})],
    });
    const healthSection = mountWithTheme(
      <ReleasesList {...props} selection={{...props.selection, projects: [-1]}} />,
      routerContext
    ).find('ReleaseHealth');

    expect(healthSection.find('HiddenProjectsMessage').exists()).toBeFalsy();

    expect(healthSection.find('ProjectRow').length).toBe(1);
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

    const semverOrg = {...organization, features: ['semver']};
    wrapper.setProps({...props, organization: semverOrg});
    wrapper.find('SmartSearchBar textarea').simulate('click');
    wrapper
      .find('SmartSearchBar textarea')
      .simulate('change', {target: {value: 'sentry.semv'}});

    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="search-autocomplete-item"]').at(0).text()).toBe(
      'release.version:'
    );

    wrapper.find('SmartSearchBar textarea').simulate('focus');
    wrapper
      .find('SmartSearchBar textarea')
      .simulate('change', {target: {value: 'release.version:'}});

    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="search-autocomplete-item"]').at(0).text()).toBe(
      'sentry@0.5.3'
    );
  });
});
