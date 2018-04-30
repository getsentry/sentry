import React from 'react';
import {mount} from 'enzyme';
import ProjectBadge from 'app/components/idBadge/projectBadge';

describe('ProjectBadge', function() {
  it('renders with Avatar and team name', function() {
    let wrapper = mount(
      <ProjectBadge project={TestStubs.Project()} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAvatar')).toHaveLength(0);
    expect(wrapper.find('BadgeDisplayName').text()).toEqual('project-slug');
  });
});
