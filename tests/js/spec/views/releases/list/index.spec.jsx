import React from 'react';

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
    selection: {projects: []},
    params: {orgId: organization.slug},
    location: {
      query: {
        query: 'derp',
        sort: SortOption.SESSIONS,
        healthStatsPeriod: '24h',
        healthStat: 'sessions',
        somethingBad: 'XXX',
        status: StatusOption.ACTIVE,
      },
    },
  };
  let wrapper, endpointMock;

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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    wrapper = mountWithTheme(<ReleasesList {...props} />, routerContext);
    await tick();
    wrapper.update();
  });

  afterEach(function () {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('renders list', function () {
    const items = wrapper.find('StyledPanel');

    expect(items).toHaveLength(3);
    expect(items.at(0).text()).toContain('1.0.0');
    expect(items.at(0).text()).toContain('User Adoption');
    expect(items.at(1).text()).toContain('1.0.1');
    expect(items.at(1).find('DailyColumn').at(1).text()).toContain('\u2014');
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
    expect(wrapper.find('Promo').text()).toContain('Demystify Releases');

    location = {query: {statsPeriod: '30d'}};
    wrapper = mountWithTheme(
      <ReleasesList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('StyledPanel')).toHaveLength(0);
    expect(wrapper.find('EmptyMessage').text()).toEqual('There are no releases.');

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
          healthStat: 'sessions',
        }),
      })
    );

    const sortDropdown = wrapper.find('ReleaseListSortOptions');
    const sortByOptions = sortDropdown.find('DropdownItem span');

    const dateCreatedOption = sortByOptions.at(0);
    expect(sortByOptions).toHaveLength(5);
    expect(dateCreatedOption.text()).toEqual('Date Created');

    const healthStatsControls = wrapper.find('DailyColumn span').first();
    expect(healthStatsControls.text()).toEqual('Sessions');

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
    expect(activeDisplay.text()).toEqual('DisplayCrash Free Sessions');

    const displayOptions = displayDropdown.find('DropdownItem');
    expect(displayOptions).toHaveLength(2);

    const crashFreeSessionsOption = displayOptions.at(0);
    expect(crashFreeSessionsOption.props().isActive).toEqual(true);
    expect(crashFreeSessionsOption.text()).toEqual('Crash Free Sessions');

    const crashFreeUsersOption = displayOptions.at(1);
    expect(crashFreeUsersOption.text()).toEqual('Crash Free Users');
    expect(crashFreeUsersOption.props().isActive).toEqual(false);

    crashFreeUsersOption.find('span').simulate('click');

    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        display: DisplayOption.CRASH_FREE_USERS,
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

  it('toggles health stats chart period/subject', function () {
    expect(endpointMock).toHaveBeenCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        query: expect.objectContaining({
          healthStatsPeriod: '24h',
        }),
      })
    );

    const healthStatsControls = wrapper.find('DailyColumn').first();

    expect(healthStatsControls.find('Period[selected=true]').text()).toEqual('24h');

    const period14d = healthStatsControls.find('Period[selected=false] Link').first();

    expect(period14d.prop('to')).toEqual({
      pathname: undefined,
      query: expect.objectContaining({
        healthStatsPeriod: '14d',
      }),
    });
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
      <ReleasesList {...props} selection={{projects: [2]}} />,
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
      <ReleasesList {...props} selection={{projects: [-1]}} />,
      routerContext
    ).find('ReleaseHealth');

    expect(healthSection.find('HiddenProjectsMessage').exists()).toBeFalsy();

    expect(healthSection.find('ProjectRow').length).toBe(1);
  });
});
