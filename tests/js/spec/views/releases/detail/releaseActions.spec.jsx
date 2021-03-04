import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';

import ReleaseActions from 'app/views/releases/detail/releaseActions';

describe('ReleaseActions', function () {
  const {organization} = initializeOrg();
  const release = TestStubs.Release({projects: [{slug: 'project1'}, {slug: 'project2'}]});
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
        orgSlug={organization.slug}
        projectSlug={release.projects[0].slug}
        release={release}
        refetchData={jest.fn()}
        releaseMeta={{projects: release.projects}}
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
    modal.find('ModalDialog Button[priority="primary"]').simulate('click');

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
        orgSlug={organization.slug}
        projectSlug={release.projects[0].slug}
        release={{...release, status: 'archived'}}
        refetchData={refetchDataMock}
        releaseMeta={{projects: release.projects}}
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
});
