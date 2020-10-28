import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import UserBadge from 'app/components/idBadge/userBadge';

describe('UserBadge', function () {
  const user = TestStubs.User();

  it('renders with no link when user is supplied', function () {
    const wrapper = mountWithTheme(<UserBadge user={user} />);

    expect(wrapper.find('StyledUserBadge')).toHaveLength(1);
    expect(wrapper.find('StyledName').prop('children')).toBe('Foo Bar');
    expect(wrapper.find('StyledEmail').prop('children')).toBe('foo@example.com');
    expect(wrapper.find('StyledName Link')).toHaveLength(0);
  });

  it('can display alternate display names/emails', function () {
    const wrapper = mountWithTheme(
      <UserBadge
        user={user}
        displayName="Other Display Name"
        displayEmail="Other Display Email"
      />
    );

    expect(wrapper.find('StyledName').prop('children')).toBe('Other Display Name');
    expect(wrapper.find('StyledEmail').prop('children')).toBe('Other Display Email');
  });

  it('can coalesce using username', function () {
    const username = TestStubs.User({
      name: null,
      email: null,
      username: 'the-batman',
    });
    const wrapper = mountWithTheme(<UserBadge user={username} />);

    expect(wrapper.find('StyledName').prop('children')).toBe(username.username);
    expect(wrapper.find('StyledEmail').prop('children')).toBe(null);
  });

  it('can coalesce using ipaddress', function () {
    const ipUser = TestStubs.User({
      name: null,
      email: null,
      username: null,
      ipAddress: '127.0.0.1',
    });
    const wrapper = mountWithTheme(<UserBadge user={ipUser} />);

    expect(wrapper.find('StyledName').prop('children')).toBe(ipUser.ipAddress);
    expect(wrapper.find('StyledEmail').prop('children')).toBe(null);
  });

  it('can coalesce using id', function () {
    const idUser = TestStubs.User({
      id: '99',
      name: null,
      email: null,
      username: null,
      ipAddress: null,
    });
    const wrapper = mountWithTheme(<UserBadge user={idUser} />);

    expect(wrapper.find('StyledName').prop('children')).toBe(idUser.id);
    expect(wrapper.find('StyledEmail').prop('children')).toBe(null);
  });

  it('can hide email address', function () {
    const wrapper = mountWithTheme(<UserBadge user={user} hideEmail />);

    expect(wrapper.find('StyledEmail')).toHaveLength(0);
  });
});
