import React from 'react';
import {mount, shallow} from 'sentry-test/enzyme';

import UserBadge from 'app/components/idBadge/userBadge';

describe('UserBadge', function() {
  const member = TestStubs.Member();
  const user = TestStubs.User();

  it('renders with link when member is supplied', function() {
    const wrapper = mount(<UserBadge member={member} orgId="orgId" />);

    expect(wrapper.find('StyledUserBadge')).toHaveLength(1);
    expect(wrapper.find('StyledName').prop('children')).toBe('Foo Bar');
    expect(wrapper.find('StyledEmail').prop('children')).toBe('foo@example.com');
    expect(wrapper.find('StyledName Link')).toHaveLength(1);
  });

  it('renders with no link when user is supplied', function() {
    const wrapper = mount(<UserBadge user={user} orgId="orgId" />);

    expect(wrapper.find('StyledUserBadge')).toHaveLength(1);
    expect(wrapper.find('StyledName').prop('children')).toBe('Foo Bar');
    expect(wrapper.find('StyledEmail').prop('children')).toBe('foo@example.com');
    expect(wrapper.find('StyledName Link')).toHaveLength(0);
  });

  it('can display alternate display names/emails', function() {
    const wrapper = shallow(
      <UserBadge
        user={user}
        displayName="Other Display Name"
        displayEmail="Other Display Email"
      />
    );

    expect(wrapper.find('StyledName').prop('children')).toBe('Other Display Name');
    expect(wrapper.find('StyledEmail').prop('children')).toBe('Other Display Email');
  });

  it('can coalesce using username', function() {
    const username = TestStubs.User({
      name: null,
      email: null,
      username: 'the-batman',
    });
    const wrapper = shallow(<UserBadge user={username} />);

    expect(wrapper.find('StyledName').prop('children')).toBe(username.username);
    expect(wrapper.find('StyledEmail').prop('children')).toBe(null);
  });

  it('can coalesce using ipaddress', function() {
    const ipUser = TestStubs.User({
      name: null,
      email: null,
      username: null,
      ipAddress: '127.0.0.1',
    });
    const wrapper = shallow(<UserBadge user={ipUser} />);

    expect(wrapper.find('StyledName').prop('children')).toBe(ipUser.ipAddress);
    expect(wrapper.find('StyledEmail').prop('children')).toBe(null);
  });

  it('does not use a link for member name', function() {
    const wrapper = mount(<UserBadge user={user} useLink={false} />);

    expect(wrapper.find('StyledName Link')).toHaveLength(0);
  });

  it('can hide email address', function() {
    const wrapper = mount(<UserBadge user={user} hideEmail />);

    expect(wrapper.find('StyledEmail')).toHaveLength(0);
  });

  it('renders when a member without a user to passed to member', function() {
    const wrapper = mount(<UserBadge member={{...member, user: null}} />);

    expect(wrapper.find('StyledName').prop('children')).toBe('Sentry 1 Name');
  });
});
