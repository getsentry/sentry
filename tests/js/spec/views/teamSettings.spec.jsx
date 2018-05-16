import React from 'react';
import {mount} from 'enzyme';

import TeamStore from 'app/stores/teamStore';
import TeamSettings from 'app/views/settings/organizationTeams/teamSettings';

describe('TeamSettings', function() {
  beforeEach(function() {
    MockApiClient.clearMockResponses();
    sinon.stub(window.location, 'assign');
  });

  afterEach(function() {
    window.location.assign.restore();
  });

  it('can change name and slug', async function() {
    let team = TestStubs.Team();
    let putMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'PUT',
    });
    let mountOptions = TestStubs.routerContext();
    let {router} = mountOptions.context;

    let wrapper = mount(
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
      .simulate('change', {target: {value: 'new-slug'}})
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

  it('needs team:admin in order to see remove team button', function() {
    let team = TestStubs.Team();

    let wrapper = mount(
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
        .find('PanelHeader')
        .last()
        .text()
    ).not.toBe('Remove Team');
  });

  it('can remove team', async function() {
    let team = TestStubs.Team();
    let deleteMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'DELETE',
    });
    let routerPushMock = jest.fn();
    let teamStoreTriggerMock = jest.fn();
    sinon.stub(TeamStore, 'trigger', teamStoreTriggerMock);
    TeamStore.loadInitialData([
      {
        slug: 'team-slug',
      },
    ]);

    let wrapper = mount(
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
    wrapper.find('Button[priority="danger"]').simulate('click');

    TeamStore.trigger.reset();

    // Wait for modal
    wrapper.find('ModalDialog Button[priority="danger"]').simulate('click');
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

    TeamStore.trigger.restore();
  });
});
