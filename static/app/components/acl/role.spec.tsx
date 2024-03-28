import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
  const routerContext = RouterContextFixture([
    {
      organization,
    },
  ]);

  describe('as render prop', function () {
    const childrenMock = jest.fn().mockReturnValue(null);
    beforeEach(function () {
      OrganizationStore.init();
      childrenMock.mockClear();
    });

    it('has a sufficient role', function () {
      render(<Role role="admin">{childrenMock}</Role>, {
        context: routerContext,
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: true,
      });
    });

    it('has an insufficient role', function () {
      render(<Role role="manager">{childrenMock}</Role>, {
        context: routerContext,
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
        context: routerContext,
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: true,
      });
    });

    it('does not give access to a made up role', function () {
      render(<Role role="abcdefg">{childrenMock}</Role>, {
        context: routerContext,
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
    });

    it('handles no user', function () {
      const user = {...ConfigStore.config.user};
      ConfigStore.config.user = undefined as any;
      render(<Role role="member">{childrenMock}</Role>, {
        context: routerContext,
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
      ConfigStore.config.user = user;
    });

    it('updates if user changes', function () {
      const user = {...ConfigStore.config.user};
      ConfigStore.config.user = undefined as any;
      const {rerender} = render(<Role role="member">{childrenMock}</Role>, {
        context: routerContext,
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasRole: false,
      });
      ConfigStore.config.user = user;

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
        {context: routerContext, organization}
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
        {context: routerContext, organization}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has an insufficient role', function () {
      render(
        <Role role="owner">
          <div>The Child</div>
        </Role>,
        {context: routerContext, organization}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();
    });
  });
});
