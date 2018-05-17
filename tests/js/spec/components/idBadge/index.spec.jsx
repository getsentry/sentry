import React from 'react';
import {shallow} from 'enzyme';

import IdBadge from 'app/components/idBadge';

describe('IdBadge', function() {
  let routerContext = TestStubs.routerContext();
  it('renders the correct component when `user` property is passed', function() {
    let wrapper = shallow(<IdBadge user={TestStubs.User()} />, routerContext);

    expect(wrapper.find('UserBadge')).toHaveLength(1);
  });

  it('renders the correct component when `team` property is passed', function() {
    let wrapper = shallow(<IdBadge team={TestStubs.Team()} />, routerContext);

    expect(wrapper.find('TeamBadgeContainer')).toHaveLength(1);
  });

  it('renders the correct component when `project` property is passed', function() {
    let wrapper = shallow(<IdBadge project={TestStubs.Project()} />, routerContext);

    expect(wrapper.find('ProjectBadge')).toHaveLength(1);
    expect(wrapper.find('ProjectBadge').prop('hideAvatar')).toBe(true);
  });

  it('renders the correct component when `organization` property is passed', function() {
    let wrapper = shallow(
      <IdBadge organization={TestStubs.Organization()} />,
      routerContext
    );

    expect(wrapper.find('OrganizationBadgeContainer')).toHaveLength(1);
  });

  it('throws when no valid properties are passed', function() {
    expect(() => shallow(<IdBadge />, routerContext)).toThrow();
  });
});
