import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {Role} from 'sentry/components/acl/role';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';

describe('Role', function () {
  const organization = OrganizationFixture({
    orgRole: 'admin',
    orgRoleList: [
      {
        id: 'member',
        name: 'Member',
        desc: '...',
        minimumTeamRole: 'contributor',
        isTeamRolesAllowed: true,
      },
      {
        id: 'admin',
        name: 'Admin',
        desc: '...',
        minimumTeamRole: 'admin',
        isTeamRolesAllowed: true,
      },
      {
        id: 'manager',
        name: 'Manager',
        desc: '...',
        minimumTeamRole: 'admin',
        isTeamRolesAllowed: true,
      },
      {
        id: 'owner',
        name: 'Owner',
        desc: '...',
        minimumTeamRole: 'admin',
        isTeamRolesAllowed: true,
      },
    ],
  });

  describe('as render prop', function () {
    const childrenMock = jest.fn().mockReturnValue(null);
    beforeEach(function () {
      OrganizationStore.init();
      childrenMock.mockClear();
    });

    it('has a sufficient role', function () {
      render(<Role role="admin">{childrenMock}</Role>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: true,
      });
    });

    it('has an insufficient role', function () {
      render(<Role role="manager">{childrenMock}</Role>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
    });

    it('gives access to a superuser with insufficient role', function () {
      organization.access = ['org:superuser'];
      OrganizationStore.onUpdate(organization, {replace: true});

      render(<Role role="owner">{childrenMock}</Role>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: true,
      });
    });

    it('does not give access to a made up role', function () {
      render(<Role role="abcdefg">{childrenMock}</Role>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
    });

    it('handles no user', function () {
      const user = {...ConfigStore.get('user')};
      ConfigStore.set('user', undefined as any);
      render(<Role role="member">{childrenMock}</Role>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
      act(() => ConfigStore.set('user', user));
    });

    it('updates if user changes', function () {
      ConfigStore.set('user', undefined as any);
      const {rerender} = render(<Role role="member">{childrenMock}</Role>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
      act(() => ConfigStore.set('user', UserFixture()));

      rerender(<Role role="member">{childrenMock}</Role>);
      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: true,
      });
    });

    it('handles no organization.orgRoleList', function () {
      render(
        <Role role="member" organization={{...organization, orgRoleList: []}}>
          {childrenMock}
        </Role>,
        {organization}
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
    });
  });

  describe('as React node', function () {
    it('has a sufficient role', function () {
      render(
        <Role role="member">
          <div>The Child</div>
        </Role>,
        {organization}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has an insufficient role', function () {
      render(
        <Role role="owner">
          <div>The Child</div>
        </Role>,
        {organization}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();
    });
  });
});
