import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Access from 'sentry/components/acl/access';
import ConfigStore from 'sentry/stores/configStore';

describe('Access', function () {
  const organization = OrganizationFixture({
    access: ['project:write', 'project:read'],
  });

  describe('as render prop', function () {
    const childrenMock = jest.fn().mockReturnValue(null);

    beforeEach(function () {
      childrenMock.mockClear();
    });

    it('has access', function () {
      render(<Access access={['project:write', 'project:read']}>{childrenMock}</Access>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('has no access', function () {
      render(<Access access={['org:write']}>{childrenMock}</Access>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: false,
        hasSuperuser: false,
      });
    });

    it('read access from team', function () {
      const org = OrganizationFixture({access: []});

      const team1 = TeamFixture({access: []});
      render(
        <Access access={['team:admin']} team={team1}>
          {childrenMock}
        </Access>,
        {organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: false,
          hasSuperuser: false,
        })
      );

      const team2 = TeamFixture({
        access: ['team:read', 'team:write', 'team:admin'],
      });
      render(
        <Access access={['team:admin']} team={team2}>
          {childrenMock}
        </Access>,
        {organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: true,
          hasSuperuser: false,
        })
      );
    });

    it('read access from project', function () {
      const org = OrganizationFixture({access: []});

      const proj1 = ProjectFixture({access: []});
      render(
        <Access access={['project:read']} project={proj1}>
          {childrenMock}
        </Access>,
        {organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: false,
          hasSuperuser: false,
        })
      );

      const proj2 = ProjectFixture({access: ['project:read']});
      render(
        <Access access={['project:read']} project={proj2}>
          {childrenMock}
        </Access>,
        {organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: true,
          hasSuperuser: false,
        })
      );
    });

    it('handles no org', function () {
      render(<Access access={['org:write']}>{childrenMock}</Access>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: false,
          hasSuperuser: false,
        })
      );
    });

    it('handles no user', function () {
      // Regression test for the share sheet.
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: undefined,
        })
      );

      render(<Access>{childrenMock}</Access>, {organization});

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('is superuser', function () {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({isSuperuser: true}),
        })
      );

      render(<Access isSuperuser>{childrenMock}</Access>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: true,
      });
    });

    it('is not superuser', function () {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({isSuperuser: false}),
        })
      );

      render(<Access isSuperuser>{childrenMock}</Access>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });
  });

  describe('as React node', function () {
    it('has access', function () {
      render(
        <Access access={['project:write']}>
          <p>The Child</p>
        </Access>,
        {organization}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has no access', function () {
      render(
        <Access access={['org:write']}>
          <p>The Child</p>
        </Access>,
        {organization}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();
    });

    it('has superuser', function () {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({isSuperuser: true}),
        })
      );

      render(
        <Access isSuperuser>
          <p>The Child</p>
        </Access>,
        {organization}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has no superuser', function () {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({isSuperuser: false}),
        })
      );

      render(
        <Access isSuperuser>
          <p>The Child</p>
        </Access>,
        {organization}
      );
      expect(screen.queryByRole('The Child')).not.toBeInTheDocument();
    });
  });
});
