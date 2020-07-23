import React from 'react';

import {mount} from 'sentry-test/enzyme';

import AvatarList from 'app/components/avatar/avatarList';

describe('AvatarList', function() {
  it('renders with user avatars', function() {
    const users = [TestStubs.User({id: '1'}), TestStubs.User({id: '2'})];

    const wrapper = mount(<AvatarList users={users} />);
    expect(wrapper.find('UserAvatar')).toHaveLength(2);
    expect(wrapper.find('CollapsedUsers')).toHaveLength(0);
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with collapsed avatar count if > 5 users', function() {
    const users = [
      TestStubs.User({id: '1'}),
      TestStubs.User({id: '2'}),
      TestStubs.User({id: '3'}),
      TestStubs.User({id: '4'}),
      TestStubs.User({id: '5'}),
      TestStubs.User({id: '6'}),
    ];

    const wrapper = mount(<AvatarList users={users} />);
    expect(wrapper.find('UserAvatar')).toHaveLength(5);
    expect(wrapper.find('CollapsedUsers')).toHaveLength(1);
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });
});
