import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import TeamStore from 'app/stores/teamStore';
import TeamSettings from 'app/views/settings/organizationTeams/teamSettings';

describe('TeamSettings', function() {
  beforeEach(function() {
    MockApiClient.clearMockResponses();
    jest.spyOn(window.location, 'assign');
  });

  afterEach(function() {
    window.location.assign.mockRestore();
  });

  it('can change slug', async function() {
    const team = TestStubs.Team();
    const putMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'PUT',
    });
    const mountOptions = TestStubs.routerContext();
    const {router} = mountOptions.context;

    const wrapper = mountWithTheme(
      <TeamSettings
        routes={[]}
        router={router}
        params={{orgId: 'org', teamId: team.slug}}
        team={team}
        onTeamChange={() => {}}
      />,
      mountOptions
    );

    wrapper
      .find('input[name="slug"]')
      .simulate('change', {target: {value: 'NEW SLUG'}})
      .simulate('blur');

    wrapper.find('SaveButton').simulate('click');

    expect(putMock).toHaveBeenCalledWith(
      `/teams/org/${team.slug}/`,
      expect.objectContaining({
        data: {
          slug: 'new-slug',
        },
      })
    );

    await tick();
    expect(router.replace).toHaveBeenCalledWith('/settings/org/teams/new-slug/settings/');
  });

  it('needs team:admin in order to see an enabled Remove Team button', function() {
    const team = TestStubs.Team();

    const wrapper = mountWithTheme(
      <TeamSettings
        routes={[]}
        params={{orgId: 'org', teamId: team.slug}}
        team={team}
        onTeamChange={() => {}}
      />,
      TestStubs.routerContext([{organization: TestStubs.Organization({access: []})}])
    );
    expect(
      wrapper
        .find('Panel')
        .last()
        .find('Button')
        .prop('disabled')
    ).toBe(true);
  });

  it('can remove team', async function() {
    const team = TestStubs.Team({hasAccess: true});
    const deleteMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'DELETE',
    });
    const routerPushMock = jest.fn();
    jest.spyOn(TeamStore, 'trigger');
    TeamStore.loadInitialData([
      {
        slug: 'team-slug',
        hasAccess: true,
      },
    ]);

    const wrapper = mountWithTheme(
      <TeamSettings
        router={{replace: routerPushMock}}
        routes={[]}
        params={{orgId: 'org', teamId: team.slug}}
        team={team}
        onTeamChange={() => {}}
      />,
      TestStubs.routerContext()
    );

    // Click "Remove Team button
    wrapper.find('Button[priority="danger"] button').simulate('click');

    TeamStore.trigger.mockReset();

    // Wait for modal
    wrapper.find('ModalDialog Button[priority="danger"] button').simulate('click');
    expect(deleteMock).toHaveBeenCalledWith(
      `/teams/org/${team.slug}/`,
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    await tick();
    await tick();
    expect(routerPushMock).toHaveBeenCalledWith('/settings/org/teams/');

    expect(TeamStore.getAll()).toEqual([]);

    TeamStore.trigger.mockRestore();
  });
});
