import React from 'react';
import {shallow} from 'enzyme';
import TeamBadge from 'app/components/teamBadge';

describe('TeamBadge', function() {
  beforeEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders with Avatar and team name', function() {
    let wrapper = shallow(
      <TeamBadge team={TestStubs.Team()} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAvatar')).toHaveLength(1);
    expect(wrapper.find('span').text()).toEqual('#team-slug');
  });

  it('can hide Avatar', function() {
    let wrapper = shallow(
      <TeamBadge team={TestStubs.Team()} hideAvatar />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAvatar')).toHaveLength(0);
  });
});
