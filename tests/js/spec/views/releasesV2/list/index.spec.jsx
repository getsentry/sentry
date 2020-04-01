import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import ReleaseList from 'app/views/releasesV2/list/';

describe('ReleasesV2List', function() {
  const {organization, routerContext, router} = initializeOrg({
    organization: {features: ['releases-v2']},
  });
  const props = {
    router,
    organization,
    selection: {projects: [2]},
    params: {orgId: organization.slug},
    location: {
      query: {
        query: 'derp',
        sort: 'sessions',
        healthStatsPeriod: '24h',
        healthStat: 'sessions',
        somethingBad: 'XXX',
      },
    },
  };
  let wrapper, endpointMock;

  beforeEach(function() {
    endpointMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [
        TestStubs.ReleaseV2({version: '1.0.0'}),
        TestStubs.ReleaseV2({version: '1.0.1'}),
        TestStubs.ReleaseV2({version: 'af4f231ec9a8'}, {hasHealthData: false}),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    wrapper = mountWithTheme(<ReleaseList {...props} />, routerContext);
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders list', function() {
    const items = wrapper.find('StyledPanel');

    expect(items).toHaveLength(3);
    expect(items.at(0).text()).toContain('1.0.0');
    expect(items.at(0).text()).toContain('Release adoption');
    expect(items.at(2).text()).toContain('af4f231ec9a8');
    expect(items.at(2).text()).not.toContain('Release adoption');
  });

  it('displays the right empty state', function() {
    let location;
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });

    location = {query: {}};
    wrapper = mountWithTheme(
      <ReleaseList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('StyledPanel')).toHaveLength(0);
    expect(wrapper.find('EmptyMessage').text()).toEqual('There are no releases.');

    location = {query: {query: 'abc'}};
    wrapper = mountWithTheme(
      <ReleaseList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('EmptyMessage').text()).toEqual(
      "There are no releases that match: 'abc'."
    );

    location = {query: {sort: 'sessions', statsPeriod: '7d'}};
    wrapper = mountWithTheme(
      <ReleaseList {...props} location={location} />,
      routerContext
    );
    expect(wrapper.find('EmptyMessage').text()).toEqual(
      'There are no releases with data in the last 7 days.'
    );
  });

  it('searches for a release', function() {
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

  it('sorts releases', function() {
    expect(endpointMock).toHaveBeenCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        query: expect.objectContaining({sort: 'sessions'}),
      })
    );

    const sortDropdown = wrapper.find('DropdownControl').first();
    const sortOptions = sortDropdown.find('DropdownItem span');
    const sortByDateOption = sortOptions.at(0);

    expect(sortOptions).toHaveLength(4);
    expect(sortByDateOption.text()).toEqual('Date Created');

    sortByDateOption.simulate('click');

    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        sort: 'date',
      }),
    });
  });

  it('calls api with only whitelisted query params', function() {
    expect(endpointMock).toHaveBeenCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        query: expect.not.objectContaining({
          somethingBad: 'XXX',
        }),
      })
    );
  });

  it('toggles health stats chart period/subject', function() {
    expect(endpointMock).toHaveBeenCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        query: expect.objectContaining({
          healthStatsPeriod: '24h',
          healthStat: 'sessions',
        }),
      })
    );

    const healthStatsControls = wrapper.find('DailyUsersColumn').first();

    expect(healthStatsControls.find('Period[selected=true]').text()).toEqual('24h');
    expect(healthStatsControls.find('Title[selected=true]').text()).toEqual('Sessions');

    const period14d = healthStatsControls.find('Period[selected=false] Link').first();
    const subjectUsers = healthStatsControls.find('Title[selected=false] Link').first();

    expect(period14d.prop('to')).toEqual({
      pathname: undefined,
      query: expect.objectContaining({
        healthStatsPeriod: '14d',
      }),
    });

    expect(subjectUsers.prop('to')).toEqual({
      pathname: undefined,
      query: expect.objectContaining({
        healthStat: 'users',
      }),
    });
  });
});
