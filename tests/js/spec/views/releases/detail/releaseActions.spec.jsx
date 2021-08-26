import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';

import ReleaseActions from 'app/views/releases/detail/releaseActions';

describe('ReleaseActions', function () {
  const {organization} = initializeOrg();
  const release = TestStubs.Release({projects: [{slug: 'project1'}, {slug: 'project2'}]});
  const location = {
    pathname: `/organizations/sentry/releases/${release.version}/`,
    query: {
      project: 1,
      statsPeriod: '24h',
      yAxis: 'events',
    },
  };
  let mockUpdate;

  beforeEach(function () {
    mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      method: 'POST',
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('archives a release', async function () {
    const wrapper = mountWithTheme(
      <ReleaseActions
        organization={organization}
        projectSlug={release.projects[0].slug}
        release={release}
        refetchData={jest.fn()}
        releaseMeta={{projects: release.projects}}
        location={location}
      />
    );

    wrapper.find('ActionsButton').simulate('click');

    const actions = wrapper.find('MenuItem');
    const archiveAction = actions.at(0);

    expect(actions.length).toBe(1);
    expect(archiveAction.text()).toBe('Archive');

    archiveAction.simulate('click');
    const modal = await mountGlobalModal();

    const affectedProjects = modal.find('ProjectBadge');
    expect(affectedProjects.length).toBe(2);

    // confirm modal
    modal.find('Modal Button[priority="primary"]').simulate('click');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          projects: [],
          status: 'archived',
          version: release.version,
        },
      })
    );

    await tick();

    expect(browserHistory.push).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/releases/`
    );
  });

  it('restores a release', async function () {
    const refetchDataMock = jest.fn();

    const wrapper = mountWithTheme(
      <ReleaseActions
        organization={organization}
        projectSlug={release.projects[0].slug}
        release={{...release, status: 'archived'}}
        refetchData={refetchDataMock}
        releaseMeta={{projects: release.projects}}
        location={location}
      />
    );

    wrapper.find('ActionsButton').simulate('click');

    const actions = wrapper.find('MenuItem');
    const restoreAction = actions.at(0);

    expect(actions.length).toBe(1);
    expect(restoreAction.text()).toBe('Restore');

    restoreAction.simulate('click');
    const modal = await mountGlobalModal();

    const affectedProjects = modal.find('ProjectBadge');
    expect(affectedProjects.length).toBe(2);

    // confirm modal
    modal.find('Button[priority="primary"]').simulate('click');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          projects: [],
          status: 'open',
          version: release.version,
        },
      })
    );

    await tick();

    expect(refetchDataMock).toHaveBeenCalledTimes(1);
  });

  it('navigates to a next/prev release', function () {
    const wrapper = mountWithTheme(
      <ReleaseActions
        organization={organization}
        projectSlug={release.projects[0].slug}
        release={release}
        refetchData={jest.fn()}
        releaseMeta={{projects: release.projects}}
        location={location}
      />
    );

    expect(wrapper.find('Link[aria-label="Oldest"]').prop('to')).toEqual({
      pathname: '/organizations/sentry/releases/0/',
      query: {
        project: 1,
        statsPeriod: '24h',
        yAxis: 'events',
        activeRepo: undefined,
      },
    });
    expect(wrapper.find('Link[aria-label="Older"]').prop('to')).toEqual({
      pathname: '/organizations/sentry/releases/123/',
      query: {
        project: 1,
        statsPeriod: '24h',
        yAxis: 'events',
        activeRepo: undefined,
      },
    });
    expect(wrapper.find('Link[aria-label="Newer"]').prop('to')).toEqual({
      pathname: '/organizations/sentry/releases/456/',
      query: {
        project: 1,
        statsPeriod: '24h',
        yAxis: 'events',
        activeRepo: undefined,
      },
    });
    expect(wrapper.find('Link[aria-label="Newest"]').prop('to')).toEqual({
      pathname: '/organizations/sentry/releases/999/',
      query: {
        project: 1,
        statsPeriod: '24h',
        yAxis: 'events',
        activeRepo: undefined,
      },
    });

    const wrapper2 = mountWithTheme(
      <ReleaseActions
        organization={organization}
        projectSlug={release.projects[0].slug}
        release={release}
        refetchData={jest.fn()}
        releaseMeta={{projects: release.projects}}
        location={{
          ...location,
          pathname: `/organizations/sentry/releases/${release.version}/files-changed/`,
        }}
      />
    );

    expect(wrapper2.find('Link[aria-label="Newer"]').prop('to')).toEqual({
      pathname: '/organizations/sentry/releases/456/files-changed/',
      query: {
        project: 1,
        statsPeriod: '24h',
        yAxis: 'events',
        activeRepo: undefined,
      },
    });
  });
});
