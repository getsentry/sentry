import React from 'react';
import {mount} from 'enzyme';
import TeamBadge from 'app/components/idBadge/teamBadge';

describe('TeamBadge', function() {
  it('renders with Avatar and team name', function() {
    const wrapper = mount(
      <TeamBadge team={TestStubs.Team()} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAvatar')).toHaveLength(1);
    expect(wrapper.find('BadgeDisplayName').text()).toEqual('#team-slug');
  });
});
