import React from 'react';

import {mount} from 'sentry-test/enzyme';

import Role from 'app/components/acl/role';
import ConfigStore from 'app/stores/configStore';

describe('Role', function () {
  const organization = TestStubs.Organization({
    role: 'admin',
    availableRoles: [
      {
        id: 'member',
        name: 'Member',
      },
      {
        id: 'admin',
        name: 'Admin',
      },
      {
        id: 'manager',
        name: 'Manager',
      },
      {
        id: 'owner',
        name: 'Owner',
      },
    ],
  });
  const routerContext = TestStubs.routerContext([
    {
      organization,
    },
  ]);

  describe('as render prop', function () {
    const childrenMock = jest.fn().mockReturnValue(null);
    beforeEach(function () {
      childrenMock.mockClear();
    });

    it('has a sufficient role', function () {
      mount(<Role role="admin">{childrenMock}</Role>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: true,
      });
    });

    it('has an unsufficient role', function () {
      mount(<Role role="manager">{childrenMock}</Role>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
    });

    it('gives access to a superuser with unsufficient role', function () {
      ConfigStore.config.user = {isSuperuser: true};
      mount(<Role role="owner">{childrenMock}</Role>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: true,
      });
      ConfigStore.config.user = {isSuperuser: false};
    });

    it('does not give access to a made up role', function () {
      mount(<Role role="abcdefg">{childrenMock}</Role>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
    });

    it('handles no user', function () {
      const user = {...ConfigStore.config.user};
      ConfigStore.config.user = undefined;
      mount(<Role role="member">{childrenMock}</Role>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
      ConfigStore.config.user = user;
    });

    it('handles no availableRoles', function () {
      mount(
        <Role role="member" organization={{...organization, availableRoles: undefined}}>
          {childrenMock}
        </Role>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
    });
  });

  describe('as React node', function () {
    it('has a sufficient role', function () {
      const wrapper = mount(
        <Role role="member">
          <div>The Child</div>
        </Role>,
        routerContext
      );

      expect(wrapper.find('Role div').exists()).toBeTruthy();
    });

    it('has an unsufficient role', function () {
      const wrapper = mount(
        <Role role="owner">
          <div>The Child</div>
        </Role>,
        routerContext
      );

      expect(wrapper.find('Role div').exists()).toBeFalsy();
    });
  });
});
