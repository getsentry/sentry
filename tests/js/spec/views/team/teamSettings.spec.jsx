import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import TeamStore from 'sentry/stores/teamStore';
import TeamSettings from 'sentry/views/settings/organizationTeams/teamSettings';

describe('TeamSettings', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.spyOn(window.location, 'assign');
  });

  afterEach(function () {
    window.location.assign.mockRestore();
  });

  it('can change slug', async function () {
    const team = TestStubs.Team();
    const putMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'PUT',
    });

    const wrapper = mountWithTheme(
      <TeamSettings
        team={team}
        onTeamChange={() => {}}
        params={{orgId: 'org', teamId: team.slug}}
      />
    );

    wrapper
      .find('input[name="slug"]')
      .simulate('change', {target: {value: 'NEW SLUG'}})
      .simulate('blur');

    wrapper.find('button[aria-label="Save"]').simulate('click');

    expect(putMock).toHaveBeenCalledWith(
      `/teams/org/${team.slug}/`,
      expect.objectContaining({
        data: {
          slug: 'new-slug',
        },
      })
    );

    await tick();
    expect(browserHistory.replace).toHaveBeenCalledWith(
      '/settings/org/teams/new-slug/settings/'
    );
  });

  it('needs team:admin in order to see an enabled Remove Team button', function () {
    const team = TestStubs.Team();

    const wrapper = mountWithTheme(
      <TeamSettings
        team={team}
        onTeamChange={() => {}}
        params={{orgId: 'org', teamId: team.slug}}
      />,
      TestStubs.routerContext([
        {
          organization: TestStubs.Organization({access: []}),
        },
      ])
    );
    expect(wrapper.find('Panel').last().find('Button').prop('disabled')).toBe(true);
  });

  it('can remove team', async function () {
    const team = TestStubs.Team({hasAccess: true});
    const deleteMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'DELETE',
    });
    jest.spyOn(TeamStore, 'trigger');
    TeamStore.loadInitialData([
      {
        slug: 'team-slug',
        hasAccess: true,
      },
    ]);

    const wrapper = mountWithTheme(
      <TeamSettings
        params={{orgId: 'org', teamId: team.slug}}
        team={team}
        onTeamChange={() => {}}
      />
    );

    // Click "Remove Team button
    wrapper.find('Button[priority="danger"] button').simulate('click');

    TeamStore.trigger.mockReset();

    // Wait for modal
    const modal = await mountGlobalModal();
    modal.find('Button[priority="danger"] button').simulate('click');

    expect(deleteMock).toHaveBeenCalledWith(
      `/teams/org/${team.slug}/`,
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    await tick();
    await tick();
    expect(browserHistory.replace).toHaveBeenCalledWith('/settings/org/teams/');

    expect(TeamStore.getAll()).toEqual([]);

    TeamStore.trigger.mockRestore();
  });
});
