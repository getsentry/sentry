import React from 'react';
import {mount} from 'enzyme';

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

  it('can change name and slug', async function() {
    const team = TestStubs.Team();
    const putMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'PUT',
    });
    const mountOptions = TestStubs.routerContext();
    const {router} = mountOptions.context;

    const wrapper = mount(
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
      .find('input[name="name"]')
      .simulate('change', {target: {value: 'New Name'}})
      .simulate('blur');

    expect(putMock).toHaveBeenCalledWith(
      `/teams/org/${team.slug}/`,
      expect.objectContaining({
        data: {
          name: 'New Name',
        },
      })
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
    expect(router.push).toHaveBeenCalledWith('/settings/org/teams/new-slug/settings/');
  });

  it('needs team:admin in order to see an enabled Remove Team button', function() {
    const team = TestStubs.Team();

    const wrapper = mount(
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
    const team = TestStubs.Team();
    const deleteMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'DELETE',
    });
    const routerPushMock = jest.fn();
    jest.spyOn(TeamStore, 'trigger');
    TeamStore.loadInitialData([
      {
        slug: 'team-slug',
      },
    ]);

    const wrapper = mount(
      <TeamSettings
        router={{push: routerPushMock}}
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

    expect(TeamStore.items).toEqual([]);

    TeamStore.trigger.mockRestore();
  });
});
