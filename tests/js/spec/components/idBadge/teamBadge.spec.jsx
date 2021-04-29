import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import TeamBadge from 'app/components/idBadge/teamBadge';
import TeamStore from 'app/stores/teamStore';

describe('TeamBadge', function () {
  beforeEach(() => {
    TeamStore.init();
  });

  it('renders with Avatar and team name', function () {
    const wrapper = mountWithTheme(
      <TeamBadge team={TestStubs.Team()} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAvatar')).toHaveLength(1);
    expect(wrapper.find('BadgeDisplayName').text()).toEqual('#team-slug');
  });

  it('listens for avatar changes from TeamStore', function () {
    const team = TestStubs.Team();
    const wrapper = mountWithTheme(<TeamBadge team={team} />, TestStubs.routerContext());

    TeamStore.onUpdateSuccess(team.id, {
      ...team,
      avatar: 'better_avatar.jpg',
    });

    expect(wrapper.state('team').avatar).toBe('better_avatar.jpg');
  });

  it('updates state from props', function () {
    const team = TestStubs.Team();
    const wrapper = mountWithTheme(<TeamBadge team={team} />, TestStubs.routerContext());
    wrapper.setProps({
      team: {
        ...team,
        avatar: 'better_avatar.jpg',
      },
    });

    expect(wrapper.state('team').avatar).toBe('better_avatar.jpg');
  });
});
